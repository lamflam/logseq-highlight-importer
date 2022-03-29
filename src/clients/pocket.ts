export interface PocketItem {
    resolved_id: string;
    resolved_title?: string;
    resolved_url?: string;
    time_added: string;
    sort_id: number;
}

interface PocketResult {
    list: { [id: string]: PocketItem };
}

export class PocketClient {
    baseApiUrl = 'https://getpocket.com/v3';
    accessToken: string;
    consumerKey: string;
    since?: string;

    constructor(consumerKey: string, accessToken: string, since?: string) {
        this.accessToken = accessToken;
        this.consumerKey = consumerKey;
        this.since = since;
    }

    itemsUrl = () => {
        return `${this.baseApiUrl}/get`;
    };

    getAllItems = async (): Promise<PocketItem[]> => {
        const resp = await fetch(this.itemsUrl(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Accept': 'application/json' },
            body: JSON.stringify({ consumer_key: this.consumerKey, access_token: this.accessToken, since: this.since }),
        });
        if (resp.ok) {
            const result = (await resp.json()) as unknown as PocketResult;
            return Object.values(result.list).sort((a, b) => b.sort_id - a.sort_id);
        }
        return Promise.reject(resp.statusText);
    };
}
