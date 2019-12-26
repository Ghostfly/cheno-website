import { html, TemplateResult } from 'lit-html';
import { property, PropertyValues, query, css, queryAll } from 'lit-element';

import Page from '../core/strategies/Page';
import { repeat } from 'lit-html/directives/repeat';
import Constants from '../constants';
import { wrap } from '../core/errors/errors';
import { WPCategory } from '../interfaces';
import { pulseWith, fadeWith } from '../core/animations';
import { timer, BehaviorSubject, scheduled, animationFrameScheduler, Subject, EMPTY, fromEvent, combineLatest } from 'rxjs';
import { switchMap, takeUntil, startWith, debounceTime, map } from 'rxjs/operators';
import { Utils, decodeHTML, slugify } from '../core/ui/ui';
import { unsafeHTML } from 'lit-html/directives/unsafe-html';
import { HomeStyling } from './home-styles';
import { LinearProgress } from '@material/mwc-linear-progress';
import { IronImageElement } from '@polymer/iron-image';

enum SwitchingState {
    willPrev = 'prev',
    willNext = 'next'
};

interface Sculpture {
    featuredImage: {
        sourceUrl: string;
    };
    content: {
        rendered: string;
    };
    title: string;
};

class Home extends Page {
    public static readonly is: string = 'ui-home';

    @query('.series') protected series!: HTMLElement;
    @query('#unfold') protected unfold!: HTMLElement;
    @query('#previewed') protected _previewed!: IronImageElement;
    @query('#pause') protected pause!: HTMLElement;
    @query('#main-progress') protected progress!: LinearProgress;
    @queryAll('.loader') protected loaders!: NodeListOf<HTMLDivElement>;

    @property({type: Boolean, reflect: false})
    public loaded = false;
    @property({type: Array, reflect: false})
    public categories: ReadonlyArray<WPCategory> = [];
    @property({type: String, reflect: false})
    public previewing: string;
    @property({type: Number, reflect: false})
    public selected = 0;
    @property({type: Number, reflect: false})
    public sculptureIndex = 1;
    @property({type: Number, reflect: false})
    public sculptureMax = 0;

    @property({type: Number, reflect: false})
    public serieProgress = 0;
    @property({type: Object, reflect: false})
    private _focused: Sculpture;

    /* Non-updating values */
    private _currentAnimation: Animation;
    private _enforcePauseSub: BehaviorSubject<boolean>;
    private _stop: Subject<unknown>;
    private _setup = false;

    public static get styles(){
        return [
            ... super.styles,
            HomeStyling,
            css`
            .text-input__loading {
                width: 100%;
            }

            .text-input__loading--line {
                transition: width .3s;
                margin-top: 3em;
                margin-bottom: 3em;
                margin-left: auto; 
                margin-right: 10%;
                animation: pulse 1s infinite ease-in-out;
            }
            
            @keyframes pulse {
                0% {
                    background-color: rgba(165, 165, 165, 0.1);
                }
                50% {
                    background-color: rgba(165, 165, 165, 0.3);
                }
                100% {
                    background-color: rgba(165, 165, 165, 0.1);
                }
            }
            `
        ];
    }
    
    public disconnectedCallback(){
        super.disconnectedCallback();
        this._stop.next(true);
        this._stop.complete();
    }

    private _setupWalk(){
        this._stop = new Subject();
        this._enforcePauseSub = new BehaviorSubject<boolean>(false);

        const pause$ = combineLatest([this._enforcePauseSub, fromEvent(this.pause, 'click')]).pipe(
            map(([enforced, _event]) => {
                if(enforced || this.pause.innerText === 'play_arrow'){
                    return true;
                }

                return false;
            })
        );

        return scheduled(pause$, animationFrameScheduler).pipe(
            debounceTime(300),
            startWith(null as Event),
            switchMap((paused) => {                    
                this.pause.innerText = paused ? 'pause' : 'play_arrow';
                if(paused){
                    this.progress.close();
                } else {
                    this.progress.open();
                }

                if(paused) return EMPTY;

                return timer(3500, 3500);
            }),
            takeUntil(this._stop),
            switchMap(async() => {                               
                if(this._canNext()){
                    await this._onNextSculpture();                
                    return;
                }

                this.selected++;

                const next = this.selected == (this._catMax-1) ? 0 : this.selected;
                await this._onCatClick(next);
            })
        ).toPromise();
    }

    public async firstUpdated(_changedProperties: PropertyValues){
        super.firstUpdated(_changedProperties);

        const requestR = await fetch(Constants.graphql, {
			method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: `{
                    categories {
                      nodes {
                        sculptures(where: {orderby: {field: MODIFIED, order: DESC}}) {
                          nodes {
                            featuredImage {
                              sourceUrl(size: MEDIUM_LARGE)
                            }
                            content(format: RENDERED)
                            title(format: RENDERED)
                          }
                        }
                        name
                        slug
                      }
                    }
                  }
                  `})})
            .then(res => res.json()).catch(_ => this.dispatchEvent(wrap(_)));

        this.categories = requestR.data.categories.nodes;

        const catSculpture = location.pathname.split('/').filter((val) => val !== '' && val !== 'home');
        this.selected = this.categories.findIndex(category => category.slug === catSculpture[0]);

        if(this.selected === -1){
            await this._onCatClick(0);
        } else {
            this._focused = this.categories[this.selected].sculptures.nodes.find((sculpture) => slugify(sculpture.title, '-') === catSculpture[1]);
            const sculptIndex = this.categories[this.selected].sculptures.nodes.findIndex((sculpture) => slugify(sculpture.title, '-') === catSculpture[1]);

            this.sculptureIndex = sculptIndex === -1 ? 1 : sculptIndex + 1;
            this.sculptureMax = this.categories[this.selected].sculptures.nodes.length;
            await this._definePreviewed();
        }


        setTimeout( async() => {
            for(const loader of Array.from(this.loaders)){
                const fadeOut = fadeWith(300, false);
                const animation = loader.animate(fadeOut.effect, fadeOut.options);
                await animation.finished;
                this.loaded = true;
            }
        }, 1000);
    }

    public async updated(){
        if(this.loaded && !this._setup){
            this._setup = true;
            await this._setupWalk();
        }
    }

    private async _onCatClick(idx: number){
        this.selected = idx;
        this.sculptureIndex = 1;
        this.sculptureMax = this.categories[idx].sculptures.nodes.length;
        
        await this._definePreviewed();

        const catItem = this.shadowRoot.querySelector('.series ul li.serie-'+idx+'');
        if(!catItem){
            return;
        }
        
        if(!Utils.isInViewport(catItem)){
            const y = catItem.getBoundingClientRect().top + window.pageYOffset - 100;
            window.scrollTo({top: y, behavior: 'smooth'});
        }

        await this._fadeCurrent();
    }

    private async _fadeCurrent(){
        if(!this._previewed){
            return;
        }

        if(this._currentAnimation){
            this._currentAnimation.cancel();
        }

        const animate = () => {
            let animation = pulseWith(300);
            this._currentAnimation = this._previewed.animate(animation.effect, animation.options);
            if(this._focused){
                animation = fadeWith(300, true);
                this.series.animate(animation.effect, animation.options);
            }
        };

        animate();
    }

    private get _catMax(){
        return this.categories.length - 1;
    }

    private _canPrev(){
        return this.sculptureIndex !== 1;
    }

    private _canNext(){
        return this.sculptureIndex+1 <= this.sculptureMax;
    }

    private get sculpture(){
        return this.sculptureIndex-1;
    }

    private async _definePreviewed(){
        if(this._focused){
            this._focused = this.categories[this.selected].sculptures.nodes[this.sculpture];
            history.pushState({}, this._focused.title, 'home/' + this.categories[this.selected].slug + '/' + slugify(this._focused.title, '-'));
        } else {
            history.pushState({}, this.categories[this.selected].name, 'home/' + this.categories[this.selected].slug);
        }

        this.previewing = this.categories[this.selected].sculptures.nodes[this.sculpture].featuredImage.sourceUrl;

        await this.updateComplete;
    }

    private async _move(state: SwitchingState){
        switch(state){
            case SwitchingState.willPrev:
                this.sculptureIndex--;
                break;
            case SwitchingState.willNext:
                this.sculptureIndex++;
                break;
        }

        await this._definePreviewed();
        await this._fadeCurrent();   
    }

    private async _onPrevSculpture(_e?: Event){
        if(this.sculptureIndex === 1 && this.selected > 0){
            this.selected--;
            await this._onCatClick(this.selected);
            return;
        }

        if(!this._canPrev()){ return; }

        await this._move(SwitchingState.willPrev);
    }

    private async _onNextSculpture(_e?: Event){
        if(this.sculptureIndex === this.sculptureMax){
            if(this.selected+1 <= this._catMax){
                this.selected++;
            } else {
                this.selected = 0;
            }

            await this._onCatClick(this.selected);
            return;
        }

        if(!this._canNext()){ return; }

        await this._move(SwitchingState.willNext);
    }

    private async _onSingle(){
        const config = fadeWith(300, false);
        const animation = this.series.animate(config.effect, config.options);
        await animation.finished;

        const willFocus = this._focused !== this.categories[this.selected].sculptures.nodes[this.sculpture];
        
        if(willFocus){
            this.unfold.innerText = 'minimize';
            this._focused = this.categories[this.selected].sculptures.nodes[this.sculpture];
            history.pushState({}, this._focused.title, 'home/' + this.categories[this.selected].slug + '/' + slugify(this._focused.title, '-'));
        } else {
            this.unfold.innerText = 'maximize';
            this._focused = null;
            history.pushState({}, this.categories[this.selected].name, 'home/' + this.categories[this.selected].slug);
        }
    }

    private loadingPlaceholder(bars: number, definedWidth: number = null, definedHeight: number = null){
        function rand(min: number, max: number): number {
            return Math.floor(Math.random() * (max - min) ) + min;
        }

        const fakeArr = new Array(bars);

        const randomHeight = () => definedHeight ? definedHeight : rand(100, window.innerHeight / (bars * 2));
        const randomWidth = () => definedWidth ? definedWidth : rand(0, window.innerWidth / 2.5);

        return html`
        <div class='loader text-input__loading'>
            ${repeat(fakeArr, () => html`
                <div class='text-input__loading--line picture' .style="width: ${randomWidth()}px; height: ${randomHeight()}px"></div>
            `)}
        </div>
        `;
    }

    public render(): void | TemplateResult {
        return html`
        <div class="home-container">
            ${this.loaded ? html`
            ${!this._focused ? html`<div class="series">
                <nav>
                    <ul>
                        ${repeat(this.categories, (category, idx) => html`<li class="serie serie-${idx} ${this.selected === idx ? 'selected disabled' : ''}" @click=${() => this.selected === idx ? null : this._onCatClick(idx)}><h1 class="big">${category.name}</h1></li>`)}
                    </ul>
                </nav>
            </div>` : html`
            <div class="series">
                <div class="single-container">
                    <h3 class="single-cat" @click=${this._onSingle}>- ${this.categories[this.selected].name}</h3>
                    <div class="title-container">
                        <h1>${decodeHTML(this._focused.title)}</h1>
                    </div>
                    <div class="content">
                        ${unsafeHTML(this._focused.content)}
                    </div>
                </div>
            </div>
            `}
            <div class="preview">
                <iron-image id="previewed" class="previewed" src=${this.previewing} sizing="contain" fade @click=${this._onSingle}></iron-image>
                <div class="unfold">
                    <mwc-icon id="unfold" @click=${this._onSingle}>maximize</mwc-icon>
                </div>
                <div class="count">
                    <mwc-icon class="${this.selected === 0 && this.sculptureIndex === 1 ? 'disabled' : ''}" @click=${this._onPrevSculpture}>chevron_left</mwc-icon>
                    <div class="pagination"><span class="current">${this.sculptureIndex}</span> / <span class="total">${this.sculptureMax}</span></div> 
                    <mwc-icon @click=${this._onNextSculpture}>chevron_right</mwc-icon>
                    <mwc-icon id="pause" @click=${() => {
                        this._enforcePauseSub.next(!this._enforcePauseSub.getValue());
                    }}>play_arrow</mwc-icon>
                </div>
                <div class="progress">
                    <mwc-linear-progress id="main-progress" progress=${this.sculptureIndex / this.sculptureMax} buffer=${this.selected / this._catMax}></mwc-linear-progress>
                </div>
            </div>
            ` : html`
            <div class="series">
                <div class="single-container">
                    ${this.loadingPlaceholder(20, null, 10)}
                </div>
            </div>
            <div class="preview">
                ${this.loadingPlaceholder(1, window.innerWidth / 3, 300)}
            </div>
            `}
        </div>
        `;
    }
}
customElements.define(Home.is, Home);