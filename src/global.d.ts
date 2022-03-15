// import type { BlockEntity, PageEntity } from '@logseq/libs/dist/LSPlugin.user';

interface Bookmark {
    hash: string;
    title: string;
    url?: string;
    tags?: string[];
    properties?: Record<string, string | undefined>;
    highlights?: Highlight[];
    created?: Date;
}

interface Highlight {
    hash: string;
    text: string;
    tags?: string[];
    properties?: Record<string, string | undefined>;
    created?: Date;
}

interface PluginSettings {
    hnUsername: string;
    hnLastSync: string;
    rwApiKey: string;
    rwLastSync: string;
}
