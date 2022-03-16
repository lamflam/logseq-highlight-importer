export interface Favorite {
    id: string;
    link: string;
    title: string;
}

export interface HNItem {
    id: string;
    by: string;
    time: number;
    title: string;
    url?: string;
    type: 'story' | 'comment';
}

export class HNClient {
    baseApiUrl = 'https://hacker-news.firebaseio.com';
    baseFavoritesUrl = 'https://hnfavs.reactual.autocode.gg';
    username: string;
    since?: string;

    constructor(username: string, since?: string) {
        this.username = username;
        this.since = since;
    }

    favoritesPageUrl = (id: string, limit: number, offset: number): string => {
        return `${this.baseFavoritesUrl}/?id=${id}&offset=${offset}&limit=${limit}`;
    };

    itemUrl = (id: string) => {
        return `${this.baseApiUrl}/v0/item/${id}.json`;
    };

    getFavorites = async (id: string, limit: number, offset: number): Promise<Favorite[]> => {
        const resp = await fetch(this.favoritesPageUrl(id, limit, offset));
        return resp.ok ? (resp.json() as unknown as Favorite[]) : Promise.reject(resp.statusText);
    };

    getAllFavorites = async (id: string): Promise<Favorite[]> => {
        const favorites: Favorite[] = [];
        let offset = 0;
        const limit = 5;
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const page = await this.getFavorites(id, limit, offset);
            favorites.push(...page);
            if (page.length !== 30 * limit || favorites.find((f) => f.id === this.since)) break;
            offset += limit;
        }
        const sinceIndex = favorites.findIndex((f) => f.id === this.since);
        return sinceIndex >= 0 ? favorites.filter((_, idx) => idx < sinceIndex) : favorites;
    };

    getItem = async (id: string): Promise<HNItem> => {
        const resp = await fetch(this.itemUrl(id));
        return resp.ok ? (resp.json() as unknown as HNItem) : Promise.reject(resp.statusText);
    };

    getItems = async (ids: string[]): Promise<HNItem[]> => {
        return Promise.all(ids.map(this.getItem));
    };

    getItemsToSync = async () => {
        const favoriteIds = (await this.getAllFavorites(this.username)).map(({ id }) => id);
        return await this.getItems(favoriteIds);
    };
}
