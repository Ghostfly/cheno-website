import { html, css, CSSResult, property, SVGTemplateResult } from 'lit-element';

import crayon from 'crayon';

import Root from './core/strategies/Root';

import './pages/index';
import './atoms/not-found';

import Constants from './constants';
import { wrap } from './core/errors/errors';

import { Subscription } from 'rxjs';

// Polyfills
import('./polyfill');

interface WPLink {
	id: string; label: string; url: string;
	icon?: SVGTemplateResult;
}

export class ElaraApp extends Root {
	public static readonly is: string = 'elara-app';

	public default = 'home';

	@property({type: Array, reflect: false, noAccessor: true})
	public legalLinks: WPLink[] = [];
	@property({type: Array, reflect: false, noAccessor: true})
	public socialLinks: WPLink[] = [];

	@property({type: Array, reflect: false, noAccessor: true})
	public socialThumbs: {
		src: string;
		shortcode: string;
	}[];

	@property({type: String, reflect: false, noAccessor: true})
	public logo: string;

	private _subscriptions: Subscription;

	public router: crayon.Router;

	public constructor(){
		super();
		this._subscriptions = new Subscription();

		this.router = crayon.create();
		this.router.path('/', () => {
			return this.load('home');
		});
		this.router.path('/home', () => {
			return this.load('home');
		});

		this.router.path('/page/:page', (req) => {
			return this.load('page/'+req.params.page);
		});

		this.router.path('/blog', () => {
			return this.load('blog');
		});

		this.router.path('/projet/:slug', req => {
			return this.load('projet/'+req.params.slug);
		});

		this.router.path('/post/:slug', (req) => {
			return this.load('post/'+req.params.slug);
		});

		this.router.path('/**', (req) => {
			return this.load(req.pathname.replace('/', ''));
		});

		this._subscriptions.add(this.router.events.subscribe(event => {
			if (event.type === crayon.RouterEventType.SameRouteAbort) {
				this.load(event.data.replace('/', ''));
			}
		 }));

		this.hasElaraRouting = true;
	}

	/**
	 * Setup bootstrap for website
	 *
	 * @private
	 * @memberof ElaraApp
	 */
	private async _setup(){
		const requestR = await fetch(Constants.graphql, {
			method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query: `{
					terrazzo {
					  logo
					}
				  }`
            })
		}).then(res => res.json()).catch(_ => this.dispatchEvent(wrap(_)));

		const colors = requestR.data.terrazzo;
		this.logo = colors.logo;
		
		await this.performUpdate();
	}

	public async firstUpdated(): Promise<void> {
		this.router.load();
	}

	/**
	 * Bootstrap is launched by boot.js
	 * Could contains any kind of promise who will be handled by global promise loader
	 *
	 * @readonly
	 * @memberof ElaraApp
	 */
	public get bootstrap(){		
		return Promise.all([
			this._setup(),
			import('./polymer')
		]);
	}

	public static get styles(): CSSResult[] {
		return [
		css`
		.content {
			color: var(--elara-font-color);
			display: inline-block;

			font-family: var(--elara-font-primary);
			opacity: 1;
			margin: 0;
			height: 100%;
			width: 100%;
		}

		.content.hidden {
			opacity: 0;
			z-index: 0;
			visibility: hidden;
		}

		header {
			position: fixed;
			top: 0;
			right: 0;
			left: 0;

			display: flex;
			flex-direction: row;
			justify-content: space-between;
			align-items: flex-start;

			z-index: 999;
			
			margin: 5px 30px;
		}

		footer {
			position: fixed;
			bottom: 0;
			left: 0;
			pointer-events: none;
			margin: 5px;
			color: rgba(0,0,0,.8);
			user-select: none;
		}

		@media (min-width: 700px){
			footer {
				margin: 30px;
			}
		}

		.logo {
			width: 150px; 
			height: 100px;
		}

		.menu {
			z-index: 999;
			--color: #333;
			width: 36px;
			height: 36px;
			padding: 0;
			margin: 0;
			margin-top: 10px;
			outline: none;
			position: relative;
			border: none;
			background: none;
			cursor: pointer;
			-webkit-appearence: none;
			-webkit-tap-highlight-color: transparent;
		}
		.menu svg {
			width: 64px;
			height: 48px;
			top: -6px;
			left: -14px;
			stroke: var(--color);
			stroke-width: 3px;
			stroke-linecap: round;
			stroke-linejoin: round;
			fill: none;
			display: block;
			position: absolute;
		}
		.menu svg path {
			transition: stroke-dasharray var(--duration, 0.85s) var(--easing, ease) var(--delay, 0s), stroke-dashoffset var(--duration, 0.85s) var(--easing, ease) var(--delay, 0s);
			stroke-dasharray: var(--array-1, 24px) var(--array-2, 100px);
			stroke-dashoffset: var(--offset, 126px);
			-webkit-transform: translateZ(0);
					transform: translateZ(0);
		}
		.menu svg path:nth-child(2) {
			--duration: .2s;
			--easing: ease-in;
			--offset: 100px;
			--array-2: 74px;
		}
		.menu svg path:nth-child(3) {
			--offset: 133px;
			--array-2: 107px;
		}
		.menu.active {
			--color: #fff;
		}
		.menu.active svg path {
			--offset: 57px;
		}
		.menu.active svg path:nth-child(1), .menu.active svg path:nth-child(3) {
			--delay: .15s;
			--easing: cubic-bezier(.2, .4, .2, 1.1);
		}
		.menu.active svg path:nth-child(2) {
			--duration: .4s;
			--offset: 2px;
			--array-1: 1px;
		}
		.menu.active svg path:nth-child(3) {
			--offset: 58px;
		}

		.main-menu {
			position: fixed;
			min-height: 30vh;
			width: 30vw;
			right: 0;
			top: 0;
			visibility: hidden;
			overflow: hidden;
			opacity: 0;
			transition: visibility 0s .3s, opacity .3s linear;
			border-radius: 0 0 4px 4px;
		}

		.main-menu::after {
			position: absolute;
			bottom: 26px;
			content:'';
			width: 100%;
			height: 100vh;
			background-color: rgba(86, 86, 86, .9);
			transform: skewY(-20deg);
			border-radius: 4px;
			z-index: -1;
		}

		.main-menu.visible {
			opacity: 1;
			transition: opacity .3s linear;
			visibility: visible;
		}

		.main-menu nav ul {
			padding: 0 20px;
		}

		.main-menu nav ul li {
			color: white;
			cursor: pointer;
			list-style: none;
		}

		.main-menu nav ul li h3 {
			opacity: .5;
			line-height: 3em;
			font-family: var(--elara-font-primary);
			transition: opacity .3s linear;
		}

		.main-menu nav ul li h3:hover {
			opacity: 1;
		}
	`];
	}

	private _toggleMenu(){
		this.shadowRoot.querySelector('.main-menu').classList.toggle('visible');
		this.shadowRoot.querySelector('.menu').classList.toggle('active');
	}
	
	public render() {
		return html`
			<header>
				<iron-image class="logo" sizing="contain" src="${this.logo}"></iron-image>
				<button class="menu" @click=${this._toggleMenu}>
					<svg viewBox="0 0 64 48">
						<path d="M19,15 L45,15 C70,15 58,-2 49.0177126,7 L19,37"></path>
						<path d="M19,24 L45,24 C61.2371586,24 57,49 41,33 L32,24"></path>
						<path d="M45,33 L19,33 C-8,33 6,-2 22,14 L45,37"></path>
					</svg>
				</button>
				<div class="main-menu">
					<nav>
						<ul>
							<li><h3>Accueil</h3></li>
							<li><h3>Visites</h3></li>
							<li><h3>Expositions</h3></li>
							<li><h3>A propos</h3></li>
							<li><h3>Contact</h3></li>
						</ul>
					</nav>
				</div>
			</header>
			<main id="main" class="content"></main>
			<footer>
			&copy; ${new Date().getFullYear()}. Cheno
			</footer>
		`;
	}
}

customElements.define(ElaraApp.is, ElaraApp);
