import { BlockEntity } from '@logseq/libs/dist/LSPlugin.user';
import {
    createPage,
    upsertPageProperties,
    getPage,
    getPageBlockByText,
    findBlockByText,
    createPageBlock,
    createChildBlock,
    getJournalLink,
    getTagLink,
} from 'utils';

export abstract class Source {
    abstract getBookmarks: () => Promise<Bookmark[]>;
    abstract enabled: boolean;
    abstract name: string;
    abstract setLastSync: () => void;

    sync = async () => {
        if (!this.enabled) return;
        await this.createBookmarks(await this.getBookmarks());
        this.setLastSync();
    };

    createBookmarks = async (bookmarks: Bookmark[]) => {
        for (const bookmark of bookmarks) {
            await this.createBookmark(bookmark);
        }
    };

    createBookmark = async (bookmark: Bookmark) => {
        let page = await getPage(bookmark.hash);

        // If the page exists, just upsert the properties but dont touch the title
        if (page) {
            if (bookmark.tags) await upsertPageProperties(page, { tags: bookmark.tags });
        } else {
            page = await createPage(bookmark.hash, bookmark.title, {
                tags: bookmark.tags,
                url: bookmark.url,
                created: bookmark.created ? await getJournalLink(bookmark.created) : undefined,
                ...bookmark.properties,
            });
        }

        if (bookmark.highlights) {
            for (const highlight of bookmark.highlights) {
                await this.createHighlight(bookmark, highlight);
            }
        }
    };

    createHighlight = async (bookmark: Bookmark, { text, created, tags }: Highlight) => {
        // Grab the updated page
        const highlightsBlock =
            (await getPageBlockByText(bookmark.hash, '## highlights')) ||
            ((await createPageBlock(bookmark.hash, '## highlights')) as BlockEntity);
        const highlightBlocks = (highlightsBlock.children || []) as BlockEntity[];
        const tagLinks = tags ? ` ${tags.map(getTagLink).join(' ')}` : '';
        const journalLink = created ? await getJournalLink(created) : '';
        if (journalLink) {
            const highlightDateBlock =
                findBlockByText(highlightBlocks, journalLink) ||
                ((await createChildBlock(highlightsBlock.uuid, journalLink)) as BlockEntity);
            const dateHighlightBlocks = (highlightDateBlock?.children || []) as BlockEntity[];
            const exists = !!findBlockByText(dateHighlightBlocks, `"${text}"`);
            if (!exists) {
                await createChildBlock(highlightDateBlock.uuid, `"${text}"${tagLinks}`);
            }
        } else {
            const exists = !!findBlockByText(highlightBlocks, `"${text}"`);
            if (!exists) {
                await createChildBlock(highlightsBlock.uuid, `"${text}"${tagLinks}`);
            }
        }
    };
}
