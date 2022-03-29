import '@logseq/libs';
import { Source } from './source';
import { PocketClient } from '../clients/pocket';
import { hashCode, getSettings, updateSettings, getJournalLink } from '../utils';

export class Pocket extends Source {
    client: PocketClient;
    name = 'hackernews';

    constructor() {
        super();
        const { pocketConsumerKey, pocketAccessToken, pocketLastSync } = getSettings();
        this.client = new PocketClient(pocketConsumerKey, pocketAccessToken, String(pocketLastSync));
    }

    get enabled() {
        const { pocketConsumerKey, pocketAccessToken } = getSettings();
        return !!pocketConsumerKey && !!pocketAccessToken;
    }

    setLastSync = () => {
        updateSettings({ pocketLastSync: String(Date.now() / 1000) });
    };

    getBookmarks = async () => {
        const items = await this.client.getAllItems();
        return await Promise.all(
            items
                .filter((i) => i.resolved_id && i.resolved_title)
                .map(async (item) => {
                    const url = item.resolved_url || '';
                    const hash = hashCode(url);
                    return {
                        hash,
                        url,
                        title: item.resolved_title || '',
                        tags: ['article', 'pocket'],
                        created: item.time_added ? new Date(parseInt(item.time_added) * 1000) : undefined,
                    };
                })
        );
    };
}
