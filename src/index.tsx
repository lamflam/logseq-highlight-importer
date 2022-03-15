import React from 'react';
import ReactDOM from 'react-dom';
import '@logseq/libs';
import { App } from './app';
import { sources } from './sources';
import './styles.css';

function createModel() {
    return {
        async sync() {
            const icon = parent.document.getElementById('lhi-button');
            const button = icon?.parentElement;

            if (button?.classList.contains('lhi-spin')) return;

            icon?.classList.remove('ti-arrow-bar-to-down');
            icon?.classList.add('ti-refresh');
            button?.classList.add('lhi-spin');
            logseq.App.showMsg(`Syncing bookmarks and highlights`);
            try {
                for (const S of sources) {
                    console.log(`Starting to sync ${S.name}`);
                    try {
                        await new S().sync();
                        console.log(`Finished syncing ${S.name}`);
                    } catch (error) {
                        logseq.App.showMsg(`Error syncing from ${S.name}`);
                        console.log(`Error syncing ${S.name}`, error);
                    }
                }
            } finally {
                logseq.App.showMsg(`Finished syncing bookmarks and highlights`);
                button?.classList.remove('lhi-spin');
                icon?.classList.remove('ti-refresh');
                icon?.classList.add('ti-arrow-bar-to-down');
            }
        },
    };
}

function init() {
    logseq.App.registerUIItem('toolbar', {
        key: 'sync-highlights',
        template: `
        <a class="button" data-on-click="sync">
        <span style="display: flex;">
                <i id="lhi-button" class="ti ti-arrow-bar-to-down"></i>
            </span>
        </a>`,
    });

    logseq.provideStyle(`
        @keyframes lhi-spin {
            from {transform:rotate(0deg);}
            to {transform:rotate(-360deg);}
        }
        .lhi-spin {
            animation: lhi-spin 2s infinite;
        }
        .lhi-spin > i {
            margin-top: -2px;
        }
    `);

    logseq.useSettingsSchema([
        {
            key: 'hnUsername',
            type: 'string',
            default: null,
            title: 'HN Username',
            description: 'Hacker News Username',
        },
        {
            key: 'hnLastSync',
            type: 'string',
            default: null,
            title: 'HN Last Sync Id',
            description: 'The last id that was synced from HN',
        },
        {
            key: 'rwApiKey',
            type: 'string',
            default: null,
            title: 'Readwise API Key',
            description: 'Readwise API Key',
        },
        {
            key: 'rwLastSync',
            type: 'string',
            default: null,
            title: 'Readwise Last Synced Timestamp',
            description: 'Timestamp for last time Readwise was synced.',
        },
    ]);
    ReactDOM.render(<App />, document.getElementById('root'));
}

void logseq.ready(createModel()).then(init);
