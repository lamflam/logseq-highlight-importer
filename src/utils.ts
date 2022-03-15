import '@logseq/libs';
import { getDateForPage } from 'logseq-dateutils';
import { BlockEntity, PageEntity } from '@logseq/libs/dist/LSPlugin.user';

type PageOrHash = Page | string;
type Properties = Record<string, string | string[] | undefined>;

interface Page extends PageEntity {
    properties?: Properties;
}

interface Block extends BlockEntity {
    properties?: Properties;
}

export async function createPage(hash: string, title: string, properties: Properties) {
    let pageTitle = normalizeTitle(title, 100);
    const existing = await getPage(pageTitle);
    if (existing) {
        pageTitle = normalizeTitle(title, 100, hash);
    }
    const page = await logseq.Editor.createPage(pageTitle, {}, { redirect: false });
    if (!page) throw `Error creating page: ${title}`;
    await upsertPageProperties(page, { hash, ...properties });
    return page;
}

async function getPageByHash(hash: string): Promise<Page | undefined> {
    const results = await logseq.DB.q(`(page-property hash "${hash}")`);
    return (results?.[0] as Page) || undefined;
}

export async function getPage(page: PageOrHash): Promise<Page | undefined> {
    return typeof page === 'string' ? getPageByHash(page) : page;
}

export async function getPageBlocks(pageOrHash: PageOrHash): Promise<Block[] | undefined> {
    const page = await getPage(pageOrHash);
    return page ? await logseq.Editor.getPageBlocksTree(page.name) : undefined;
}

export async function getPagePropertiesBlock(pageOrHash: PageOrHash): Promise<Block | undefined> {
    const page = await getPage(pageOrHash);
    return page ? (await getPageBlocks(page))?.[0] : undefined;
}

export async function getPageProperties(pageOrHash: PageOrHash): Promise<Properties | undefined> {
    const page = await getPage(pageOrHash);
    return page ? (await getPagePropertiesBlock(page))?.properties : undefined;
}

export async function upsertPageProperties(pageOrHash: PageOrHash, properties: Properties): Promise<void> {
    const page = await getPage(pageOrHash);
    if (!page) throw 'Page does not exist';
    const block = await getPagePropertiesBlock(page);
    if (!block) throw 'Page properties do not exist';
    await upsertBlockProperties(block, properties);
}

export function findBlockByText(blocks: Block[] | undefined, text: string) {
    return blocks?.find((block) => block.content.startsWith(text));
}

export async function getPageBlockByText(pageOrHash: PageOrHash, text: string): Promise<Block | undefined> {
    const blocks = await getPageBlocks(pageOrHash);
    return findBlockByText(blocks, text);
}

export async function createPageBlock(pageOrHash: PageOrHash, content: string) {
    const blocks = await getPageBlocks(pageOrHash);
    const firstBlock = blocks?.[0];
    if (!firstBlock) throw 'Error inserting new page block';
    const block = await logseq.Editor.insertBlock(firstBlock.uuid, content);
    await logseq.Editor.insertBlock(firstBlock.uuid, '');
    return block;
}

export async function createChildBlock(parentBlockId: string, content: string) {
    return await logseq.Editor.insertBlock(parentBlockId, content, { sibling: false });
}

const UPSERT_PROPERTIES = ['tags'];
const PROPERTY_ORDER = ['tags', 'author', 'url', 'hn-url', '__other__', 'hash'];
export async function upsertBlockProperties(block: Block, properties: Properties) {
    const { tags, ...newProps } = properties;

    if (tags) {
        let oldTags = block.properties?.tags || [];
        if (typeof oldTags === 'string') oldTags = [];
        const newTags = typeof tags === 'string' ? [] : tags || [];
        const tagSet = new Set([...oldTags.map(normalizeTag), ...newTags.map(normalizeTag)]);
        newProps['tags'] = [...tagSet].map((t) => `#${t}`).join(', ');
    }

    let content = block.content;
    const sortedProps = Object.keys(newProps).sort((a, b) => {
        const indexA = PROPERTY_ORDER.findIndex((p) => a === p || p === '__other__');
        const indexB = PROPERTY_ORDER.findIndex((p) => b === p || p === '__other__');
        return indexA - indexB;
    });
    for (const prop of sortedProps) {
        let value = newProps[prop];
        if (!value) continue;

        if (Array.isArray(value)) value = value.join(', ');
        if (content.includes(`${prop}::`) && UPSERT_PROPERTIES.includes(prop)) {
            const regex = new RegExp(`${prop}::[^\n]*\n`, 'g');
            content = content.replace(regex, `${prop}:: ${value}\n`);
        } else {
            content += `\n${prop}:: ${value}`;
        }
    }
    await logseq.Editor.updateBlock(block.uuid, content);
}

function normalizeTag(tag: string): string {
    return tag.replace(/#|[|]/, '');
}

export function getTagLink(tag: string) {
    let formatted = tag;
    if (formatted.includes(' ')) {
        formatted = `[[${formatted}]]`;
    }
    if (!formatted.startsWith('#')) {
        formatted = `#${formatted}`;
    }
    return formatted;
}

export function normalizeTitle(title: string, maxLen = 100, hash?: string) {
    const hashStr = hash ? ` (${hash})` : '';
    const replacedTitle = title
        .replace(/\//g, '\\')
        .replace(/[:.]/g, '')
        // eslint-disable-next-line no-control-regex
        .replace(/[^\x00-\x7F]/g, '')
        .replace(/\n/g, ' ');
    return `${replacedTitle.slice(0, maxLen)}${hashStr}`;
}

export function hashCode(input: string) {
    let hash = 0,
        i,
        chr;
    if (input.length === 0) return hash.toString(16);
    for (i = 0; i < input.length; i++) {
        chr = input.charCodeAt(i);
        hash = (hash << 5) - hash + chr;
        hash |= 0;
    }
    return Math.abs(hash).toString(16);
}

export async function getJournalLink(forDate: Date | string) {
    const date = typeof forDate === 'string' ? new Date(forDate) : forDate;
    const config = await logseq.App.getUserConfigs();
    return getDateForPage(date, config.preferredDateFormat);
}

export function getSettings(): PluginSettings {
    return (logseq.settings || {}) as PluginSettings;
}

export function updateSettings(settings: Partial<PluginSettings>) {
    logseq.updateSettings(settings);
}
