import '@logseq/libs';
import { Source } from './source';
import { HNClient } from '../clients/hn';
import { hashCode, getSettings, updateSettings, getJournalLink } from '../utils';

export class HN extends Source {
    client: HNClient;
    name = 'hackernews';
    lastId?: string;

    constructor() {
        super();
        const { hnUsername, hnLastSync } = getSettings();
        this.client = new HNClient(hnUsername, String(hnLastSync));
    }

    get enabled() {
        const { hnUsername } = getSettings();
        return !!hnUsername;
    }

    setLastSync = () => {
        if (this.lastId) {
            updateSettings({ hnLastSync: this.lastId });
        }
    };

    getBookmarks = async () => {
        const items = await this.client.getItemsToSync();
        this.lastId = items[0]?.id;
        return await Promise.all(
            items.map(async (item) => {
                const hnUrl = `https://news.ycombinator.com/item?id=${item.id}`;
                const url = item.url || hnUrl;
                const hash = hashCode(url);
                return {
                    hash,
                    url,
                    title: item.title,
                    tags: ['article', 'hackernews'],
                    properties: {
                        author: `[[${item.by} (hackernews)]]`,
                        'hn-url': hnUrl,
                        posted: await getJournalLink(new Date(item.time * 1000)),
                    },
                };
            })
        );
    };
}
