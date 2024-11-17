export interface GraphNode {
    id: string;
    color?: string;
    x?: number;
    y?: number;
    text?: string;
    createdAt?: string;
}
export interface GraphLink {
    source: string;
    target: string;
}
export interface GraphData {
    nodes: GraphNode[];
    links: GraphLink[];
}
interface BlueskyPost {
    $type: string;
    createdAt: string;
    text: string;
    reply?: {
        parent: {
            uri: string;
        };
        root: {
            uri: string;
        };
    };
}
export interface BlueskyMessage {
    kind: string;
    commit: {
        operation: string;
        collection: string;
        rkey: string;
        record: BlueskyPost;
    };
}
