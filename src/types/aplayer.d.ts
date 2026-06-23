/**
 * Minimal type declarations for `aplayer` (v1.10.x), which ships no types.
 * Covers the options and instance surface used in this project.
 * Upstream API: https://aplayer.js.org/#/home?id=options
 */
declare module "aplayer" {
  export interface APlayerAudio {
    name?: string;
    artist?: string;
    url: string;
    cover?: string;
    lrc?: string;
    theme?: string;
    type?: "auto" | "hls" | "normal";
  }

  export interface APlayerOptions {
    container: HTMLElement;
    fixed?: boolean;
    mini?: boolean;
    autoplay?: boolean;
    theme?: string;
    loop?: "all" | "one" | "none";
    order?: "list" | "random";
    preload?: "none" | "metadata" | "auto";
    volume?: number;
    mutex?: boolean;
    lrcType?: 0 | 1 | 2 | 3;
    listFolded?: boolean;
    listMaxHeight?: string;
    storageName?: string;
    audio: APlayerAudio | APlayerAudio[];
  }

  export default class APlayer {
    constructor(options: APlayerOptions);
    play(): void;
    pause(): void;
    seek(time: number): void;
    toggle(): void;
    on(event: string, handler: (...args: unknown[]) => void): void;
    destroy(): void;
    readonly audio: HTMLAudioElement;
    readonly options: APlayerOptions;
  }
}

declare module "aplayer/dist/APlayer.min.css";
