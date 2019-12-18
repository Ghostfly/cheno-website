import { css, TemplateResult } from 'lit-element';

export function decodeHTML(html: string){
    const txt = document.createElement('textarea');
    txt.innerHTML = html;
    return txt.value;
}

export const Processing = {
    /**
     * Convert a remote url to an image data-url
     * 
     * @param src remote url
     */
    toDataURL(src: string, quality = 1): Promise<string> {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.crossOrigin = 'Anonymous';
            
            image.onload = () => {
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = image.naturalHeight;
                canvas.width = image.naturalWidth;
                context.drawImage(image, 0, 0);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };

            image.onerror = image.onabort = () => {
                reject();
            }; 
        
            image.src = src;
        });
    },
    async retrieveAsFile(url: string, proxy: string): Promise<File> {
        try {
            const blob = await Processing.retrieveAsBlob(url, proxy);
            return new File([blob], url.replace(/[\#\?].*$/,'').substring(url.lastIndexOf('/')+1));
        } catch {
            return null;
        }
    },
    async retrieveAsBlob(url: string, proxy: string): Promise<Blob> {
        try {
            return await fetch(proxy.concat(url)).then(r => r.blob());
        } catch {
            return null;
        }
    }
};

/**
 * Return a word without accents using normalize \o/
 * @param str "Crème au chocolat"
 * @return {string} "Creme au chocolat"
 */
export function normalize(str: string): string {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function slugify(str: string, separator: string){
    str = str.trim();
    str = str.toLowerCase();

    // remove accents, swap ñ for n, etc
    const from = 'åàáãäâèéëêìíïîòóöôùúüûñç·/_,:;';
    const to = 'aaaaaaeeeeiiiioooouuuunc------';

    for (let i = 0, l = from.length; i < l; i++) {
        str = str.replace(new RegExp(from.charAt(i), 'g'), to.charAt(i));
    }

    return str
        .replace(/[^a-z0-9 -]/g, '') // remove invalid chars
        .replace(/\s+/g, '-') // collapse whitespace and replace by -
        .replace(/-+/g, '-') // collapse dashes
        .replace(/^-+/, '') // trim - from start of text
        .replace(/-+$/, '') // trim - from end of text
        .replace(/-/g, separator);
}

export function ifDefined(property: unknown, template: TemplateResult, initial: TemplateResult){
    if(!property) return initial;

    return template;
}

export const CSS = {
    queries: {
        DARK: '(prefers-color-scheme: dark)',
        LIGHT: '(prefers-color-scheme: light)',
        ANIMATIONS: '(prefers-reduced-motion: reduce)'
    },
    spinner: css`
    .loading {
        display: flex;
        width: 100%;
        flex-direction: row;
        align-items: center;
        justify-content: center;
    }
    paper-spinner {
        position: absolute;
        --paper-spinner-layer-1-color: var(--elara-primary);
        --paper-spinner-layer-2-color: var(--elara-secondary);
        --paper-spinner-layer-3-color: var(--elara-primary);
        --paper-spinner-layer-4-color: var(--elara-secondary);
    }
    `,
    images: css`
    .image-container {
        cursor: pointer;
    }
    
    .image-container.opened {
        transition: .3s;
        position: fixed;
        top: 0;
        right: 0;
        left: 0;
        bottom: 0;
        height: 100%;
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: rgba(255,255,255, .8);
        overflow: hidden;
        z-index: 999;
    }

    .image-container.opened iron-image {
        width: 100%;
        height: 100%;
    }
    `,
    cards: css`
    .cards {
        text-shadow: 0 0.1px 0 white;
        display: grid;
        grid-row-gap: 5em;
        grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); 
        /* 
        background: repeating-linear-gradient(35deg,#fff,#fff 0, #fff 0px,#eecfcb 100vw);
        background-repeat: no-repeat;
        background-size: 100vw 190vh;
        */
       grid-column-gap: 1em;
        padding: 1em 2em;
    }

    @media (max-width: 475px){
        .cards {
            background-size: 100vw;
            grid-template-columns: repeat(auto-fill, minmax(100%, 1fr)); 
        }
    }

    .card {
        /* box-shadow: 0 7px 30px -10px rgba(150,170,180,0.5); */
        background: linear-gradient( to bottom, rgba(255, 255, 255, 0), rgba(249, 249, 249, 0.8) );
        cursor: pointer;
        text-align: center;
    }

    .card.reveal {
        opacity: 0;
    }

    .card.revealed {
        opacity: 1;
        transition: opacity .3s;
    }

    @media (prefers-reduced-motion: reduce){
        .card.reveal {
            opacity: 1;
        }

        .card.revealed {
            transition: 0s;
        }
    }

    .card iron-image {
        margin: 1em 0 0 .5em;
        width: 100%;
        height: 240px;
    }

    .card .text .title {
        font-size: 1.3em;
        margin: 0 0 .5em 0;
    }

    .card .text span {
        margin: 1em;
    }
    `,
    grid: css`.grid { display: flex; flex-wrap: wrap; } .grid > div { flex: 1 0 5em; }`,
    typography: {
        buttons: css`button:focus, button:hover {outline: 1px solid var(--elara-primary); background-color: var(--elara-secondary)}; `,
        lists: css`li { list-style: none }`,
        links: css`a { cursor: pointer; color: var(--elara-font-color); text-decoration: none; transition: color .3s; } a:hover { color: var(--elara-font-hover)}`,
        heading: css`h1, h2, h3 { user-select: none; font-family: var(--elara-font-display); } h1::first-letter { font-size: 1.3em; } h2::first-letter { font-size: 1.2em }`
    },
    shortcodes: css`
    .elara_row {overflow:auto; margin-bottom:20px;}

    .elara_cfull {width:100%;}
    .elara_chalf {width:50%;}
    .elara_cthird {width:33.3%;}
    .elara_ctwo-thirds {width:66.6%;}
    .elara_cquarter {width:25%;}
    .elara_cthree-quarters {width:75%;}

    .elara_column {float:left;}
    .elara_column div.elara_inner {padding:0 20px;}

    .elara_column:first-of-type .elara_inner {padding-left:0;}
    .elara_column:last-of-type .elara_inner {padding-right:0;}

    @media only screen and (max-width: 40em) {
        .elara_cfull {width:100%;}
        .elara_chalf {width:100%;}
        .elara_cthird {width:100%;}
        .elara_ctwo-thirds {width:100%;}
        .elara_cquarter {width:100%;}
        .elara_cthree-quarters {width:100%;}
        .elara_column .elara_inner {padding:0 !important;}
        .elara_column {margin-bottom:20px;}
    }
    `
};

interface GalleryState {
    container: HTMLElement;
    listeners: {
        keyboard: (e: KeyboardEvent) => void;
        touch: (e: TouchEvent) => void;
    };
    sizing: string;
    width: string;
    height: string;
    touchstartX: number;
    touchendX: number;
};

let state: GalleryState = {
    container: null,
    listeners: {
        keyboard: null,
        touch: null
    },
    sizing: null,
    width: null,
    height: null,
    touchstartX: 0,
    touchendX: 0
};

export interface IronImageCompatibleElement extends HTMLImageElement {
    sizing: string;
}

const show = (container: HTMLElement) => {
    const image = container.querySelector('iron-image');

    state.container = container;
    state.touchstartX = 0;
    state.touchendX = 0;

    document.body.className = 'scrolling-disabled';
    state.sizing = image.sizing;
    state.width = image.style.width;
    state.height = image.style.height;

    image.style.width = '80%';
    image.style.height = '80%';

    state.container.classList.add('opened');
    state.container.focus();

    window.removeEventListener('keydown', state.listeners.keyboard);
    
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    state.listeners.keyboard = galleryListener(state.container);
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    state.listeners.touch = touchListener(state.container);

    state.container.addEventListener('touchstart', state.listeners.touch);
    state.container.addEventListener('touchend', state.listeners.touch);
    window.addEventListener('keydown', state.listeners.keyboard);
};

const hide = (container: HTMLElement) => {
    const image = container.querySelector('iron-image');

    document.body.className = '';

    image.sizing = state.sizing;
    image.style.width = state.width;
    image.style.height = state.height;

    container.removeEventListener('touchstart', state.listeners.touch);
    container.removeEventListener('touchend', state.listeners.touch);

    container.classList.remove('opened');
};

const clean = () => {
    if(state.listeners.keyboard){ window.removeEventListener('keydown', state.listeners.keyboard); }
    if(state.listeners.touch){ 
        state.container.removeEventListener('touchstart', state.listeners.touch);
        state.container.removeEventListener('touchend', state.listeners.touch);
     }

    state = {
        container: null,
        listeners: {
            keyboard: null,
            touch: null
        },
        sizing: null,
        width: null,
        height: null,
        touchstartX: 0,
        touchendX: 0
    };
};

export function touchEvents(onRight: () => void, onLeft: () => void){
    return (e: TouchEvent) => {
        if(e.type === 'touchstart'){
            state.touchstartX = e.changedTouches[0].screenX;
            return;
        } else {
            state.touchendX = e.changedTouches[0].screenX;
        }

        if (state.touchendX < state.touchstartX){
            onRight();
        }
        if (state.touchendX > state.touchstartX){
            onLeft();
        }
    };
}

const touchListener = (container: HTMLElement) => {
    return touchEvents(() => {
        const next = container.nextElementSibling as HTMLElement;
        const hasNext = next && next.classList.contains('image-container');

        if(!hasNext){
            hide(container);
            clean();
            return;
        }

        hide(container);
        show(next);
    }, () => {
        const prev = container.previousElementSibling as HTMLElement;
        const hasPrev = prev && prev.classList.contains('image-container');
        if(!hasPrev){
            hide(container);
            clean();
            return;
        }

        hide(container);
        show(prev);
    });
};

function galleryListener(container: HTMLElement) {    
    return (e: KeyboardEvent) => {
        const prev = container.previousElementSibling as HTMLElement;
        const next = container.nextElementSibling as HTMLElement;

        const hasPrev = prev && prev.classList.contains('image-container');
        const hasNext = next && next.classList.contains('image-container');

        const willDismiss = e.keyCode === 37 && !hasPrev || e.keyCode === 32 && !hasNext || e.keyCode === 39 && !hasNext || e.keyCode === 27;

        if(willDismiss){
            hide(container);
            clean();
            return;
        }
    
        switch(e.keyCode){
            // left
            case 37: {
                hide(container);
                show(prev);
                break;
            }
            // right
            case 39:
            // enter
            case 32: {
                hide(container);
                show(next);
                break;
            }
        }
    };
};

export function onImageContainerClicked(e: KeyboardEvent) {
    const container = e.currentTarget as HTMLElement;
    
    if(container.classList.contains('opened')){
        hide(container);
        clean();
    } else {
        show(container);
    }
}

export const Utils = {
    isMobile: (): boolean => {
        return window.innerWidth <= 570;
    },
    isInViewport(elem: Element) {
        const bounding = elem.getBoundingClientRect();

        return (
            bounding.top >= 0 &&
            bounding.left >= 0 &&
            bounding.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            bounding.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    },
    animationsReduced(): boolean {
        if(!window.matchMedia){
            console.warn('Elara:: MatchMedia not supported.');

            return false;
        }

        return window.matchMedia(CSS.queries.ANIMATIONS).matches;
    }
};

export function chunk<T>(arr: T[], size: number): T[][] {
    const R = [];
    for (let i=0, len=arr.length; i<len; i+=size){
        R.push(arr.slice(i,i+size));
    }
    return R;
}