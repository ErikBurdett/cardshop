import { Scene } from 'phaser';

export class Preloader extends Scene {
    constructor() {
        super('Preloader');
    }

    init() {
        //  We loaded this image in our Boot Scene, so we can display it here
        this.add.image(512, 384, 'background');

        //  A simple progress bar. This is the outline of the bar.
        this.add.rectangle(512, 384, 468, 32).setStrokeStyle(1, 0xffffff);

        //  This is the progress bar itself. It will increase in size from the left based on the % of progress.
        const bar = this.add.rectangle(512 - 230, 384, 4, 28, 0xffffff);

        //  Use the 'progress' event emitted by the LoaderPlugin to update the loading bar
        this.load.on('progress', (progress: number) => {
            //  Update the progress bar (our bar is 464px wide, so 100% = 464px)
            bar.width = 4 + 460 * progress;
        });
    }

    preload() {
        //  Load the assets for the game - Replace with your own assets
        this.load.setPath('assets');

        this.load.image('logo', 'logo.png');
        this.load.image('star', 'star.png');

        // World / environment
        this.load.image('outside_world_tile', 'woods-tile.png');
        this.load.image('shop_floor_tile', 'wood-foor.png');

        // Characters (4x4, 16 frames @ 48x48 each)
        this.load.spritesheet('knight_walking_sheet', 'knight-walking.png', {
            frameWidth: 48,
            frameHeight: 48,
        });

        this.load.spritesheet('player_shopkeeper_sheet', 'player-shopkeeper.png', {
            frameWidth: 48,
            frameHeight: 48,
        });
    }

    create() {
        //  When all the assets have loaded, it's often worth creating global objects here that the rest of the game can use.
        //  For example, you can define global animations here, so we can use them in other scenes.

        if (!this.anims.exists('knight_walking_loop')) {
            this.anims.create({
                key: 'knight_walking_loop',
                frames: this.anims.generateFrameNumbers('knight_walking_sheet', {
                    start: 0,
                    end: 15,
                }),
                frameRate: 8,
                repeat: -1,
            });
        }

        // Directional (4-angle) walking animations (future-proof for movement)
        if (!this.anims.exists('knight_walk_down')) {
            this.anims.create({
                key: 'knight_walk_down',
                frames: this.anims.generateFrameNumbers('knight_walking_sheet', {
                    start: 0,
                    end: 3,
                }),
                frameRate: 8,
                repeat: -1,
            });
        }
        if (!this.anims.exists('knight_walk_left')) {
            this.anims.create({
                key: 'knight_walk_left',
                frames: this.anims.generateFrameNumbers('knight_walking_sheet', {
                    start: 4,
                    end: 7,
                }),
                frameRate: 8,
                repeat: -1,
            });
        }
        if (!this.anims.exists('knight_walk_right')) {
            this.anims.create({
                key: 'knight_walk_right',
                frames: this.anims.generateFrameNumbers('knight_walking_sheet', {
                    start: 8,
                    end: 11,
                }),
                frameRate: 8,
                repeat: -1,
            });
        }
        if (!this.anims.exists('knight_walk_up')) {
            this.anims.create({
                key: 'knight_walk_up',
                frames: this.anims.generateFrameNumbers('knight_walking_sheet', {
                    start: 12,
                    end: 15,
                }),
                frameRate: 8,
                repeat: -1,
            });
        }

        if (!this.anims.exists('player_shopkeeper_walk_loop')) {
            this.anims.create({
                key: 'player_shopkeeper_walk_loop',
                frames: this.anims.generateFrameNumbers('player_shopkeeper_sheet', {
                    start: 0,
                    end: 15,
                }),
                frameRate: 8,
                repeat: -1,
            });
        }

        if (!this.anims.exists('player_shopkeeper_walk_down')) {
            this.anims.create({
                key: 'player_shopkeeper_walk_down',
                frames: this.anims.generateFrameNumbers('player_shopkeeper_sheet', {
                    start: 0,
                    end: 3,
                }),
                frameRate: 8,
                repeat: -1,
            });
        }
        if (!this.anims.exists('player_shopkeeper_walk_left')) {
            this.anims.create({
                key: 'player_shopkeeper_walk_left',
                frames: this.anims.generateFrameNumbers('player_shopkeeper_sheet', {
                    start: 4,
                    end: 7,
                }),
                frameRate: 8,
                repeat: -1,
            });
        }
        if (!this.anims.exists('player_shopkeeper_walk_right')) {
            this.anims.create({
                key: 'player_shopkeeper_walk_right',
                frames: this.anims.generateFrameNumbers('player_shopkeeper_sheet', {
                    start: 8,
                    end: 11,
                }),
                frameRate: 8,
                repeat: -1,
            });
        }
        if (!this.anims.exists('player_shopkeeper_walk_up')) {
            this.anims.create({
                key: 'player_shopkeeper_walk_up',
                frames: this.anims.generateFrameNumbers('player_shopkeeper_sheet', {
                    start: 12,
                    end: 15,
                }),
                frameRate: 8,
                repeat: -1,
            });
        }

        //  Move to the Shop simulation scene (auto-starts a new game / day cycle).
        this.scene.start('ShopScene');
    }
}
