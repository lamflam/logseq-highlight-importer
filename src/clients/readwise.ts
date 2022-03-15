export interface Highlight {
    id: string;
    location: number;
    text: string;
    tags: { name: string }[];
    book_id: number;
    highlighted_at: string;
}

export interface Book {
    id: number;
    title: string;
    category: 'articles' | 'tweets';
    author: string;
    source_url?: string;
    tags: { name: string }[];
    updated: string;
}

interface ReadwiseResult<T> {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
}

export class ReadwiseClient {
    baseApiUrl = 'https://readwise.io/api/v2';
    accessToken: string;
    since?: Date;
    bookCache: { [id: number]: Book };

    constructor(accessToken: string, since?: Date) {
        this.accessToken = accessToken;
        this.since = since;
        this.bookCache = {};
    }

    bookUrl = (id: number) => {
        return `${this.baseApiUrl}/books/${id}/`;
    };

    booksUrl = (limit: number, offset: number) => {
        const since = this.since ? `&updated__gt=${this.since.toISOString()}` : '';
        return `${this.baseApiUrl}/books/?page_size=${limit}&page=${offset}${since}`;
    };

    getBookById = async (id: number) => {
        let book = this.bookCache[id];
        if (!book) {
            book = await this.fetchBook(id);
        }
        this.bookCache[id] = book;
        return book;
    };

    fetchBook = async (id: number) => {
        const resp = await fetch(this.bookUrl(id), {
            headers: { Authorization: `Token ${this.accessToken}` },
        });
        return resp.ok ? (resp.json() as unknown as Book) : Promise.reject(resp.statusText);
    };

    fetchBooks = async (limit: number, offset: number): Promise<ReadwiseResult<Book>> => {
        const resp = await fetch(this.booksUrl(limit, offset), {
            headers: { Authorization: `Token ${this.accessToken}` },
        });
        return resp.ok ? (resp.json() as unknown as ReadwiseResult<Book>) : Promise.reject(resp.statusText);
    };

    fetchAllBooks = async () => {
        const books: Book[] = [];
        let offset = 1;
        const limit = 1000;
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const response = await this.fetchBooks(limit, offset);
            response.results.forEach((book) => {
                books.push(book);
                this.bookCache[book.id] = book;
            });
            if (!response.next) break;
            offset++;
        }

        return books;
    };

    highlightsUrl = (limit = 1000, offset: number) => {
        const since = this.since ? `&highlighted_at__gt=${this.since.toISOString()}` : '';
        return `${this.baseApiUrl}/highlights/?page_size=${limit}&page=${offset}${since}`;
    };

    fetchHighlights = async (limit: number, offset: number): Promise<ReadwiseResult<Highlight>> => {
        const resp = await fetch(this.highlightsUrl(limit, offset), {
            headers: { Authorization: `Token ${this.accessToken}` },
        });
        return resp.ok ? (resp.json() as unknown as ReadwiseResult<Highlight>) : Promise.reject(resp.statusText);
    };

    fetchAllHighlights = async () => {
        const highlights: Highlight[] = [];
        let offset = 1;
        const limit = 1000;
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const response = await this.fetchHighlights(limit, offset);
            highlights.push(...response.results);
            if (!response.next) break;
            offset++;
        }
        return highlights;
    };
}
