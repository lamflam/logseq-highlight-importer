import '@logseq/libs';
import { match } from 'ts-pattern';
import { Source } from './source';
import { ReadwiseClient } from '../clients/readwise';
import { hashCode, getSettings, updateSettings } from '../utils';

export class Readwise extends Source {
    client: ReadwiseClient;
    name = 'readwise';

    constructor() {
        super();
        const { rwApiKey, rwLastSync } = getSettings();
        const since = rwLastSync ? new Date(parseInt(rwLastSync)) : undefined;
        this.client = new ReadwiseClient(rwApiKey, since);
    }

    get enabled() {
        const { rwApiKey } = getSettings();
        return !!rwApiKey;
    }

    setLastSync = () => {
        updateSettings({ rwLastSync: String(Date.now()) });
    };

    getBookmarks = async () => {
        const books = await this.client.fetchAllBooks();
        const highlights = await this.client.fetchAllHighlights();
        const highlightsByBook: { [key: number]: (Highlight & { location: number })[] } = {};
        for (const highlight of highlights) {
            const { id, location, highlighted_at: highlightedAt, book_id: bookId, text, tags } = highlight;
            const book = await this.client.getBookById(bookId);
            const highlights = highlightsByBook[book.id] || [];
            highlights.push({
                hash: hashCode(id),
                location,
                text,
                tags: tags.length ? tags.map((t) => t.name) : undefined,
                properties: {},
                created: new Date(highlightedAt),
            });
            highlightsByBook[book.id] = highlights;
        }

        const bookIds = new Set(books.map((b) => b.id));
        highlights.forEach((h) => bookIds.add(h.book_id));

        return (await Promise.all([...bookIds].map(this.client.getBookById)))
            .map((book) => {
                return match(book)
                    .with({ category: 'articles' }, () => {
                        const hash = hashCode(book.source_url || String(book.id));
                        return {
                            hash,
                            created: book.updated ? new Date(book.updated) : undefined,
                            url: book.source_url,
                            title: book.title,
                            tags: ['article', 'readwise'],
                            highlights: highlightsByBook[book.id]?.sort((a, b) => a.location - b.location),
                            properties: {
                                author: book.author ? `[[${book.author}]]` : undefined,
                            },
                        };
                    })
                    .with({ category: 'tweets' }, () => {
                        const hash = hashCode(book.source_url || String(book.id));
                        return {
                            hash,
                            created: book.updated ? new Date(book.updated) : undefined,
                            url: book.source_url,
                            title: book.title,
                            tags: ['twitter', 'readwise'],
                            highlights: highlightsByBook[book.id]?.sort((a, b) => a.location - b.location),
                            properties: {
                                author: book.author ? `[[${book.author}]]` : undefined,
                            },
                        };
                    })
                    .otherwise(() => null);
            })
            .filter((b) => b) as Bookmark[];
    };
}
