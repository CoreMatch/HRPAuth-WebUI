import { useEffect } from 'react';
import metaConfig from '../../config/meta.json';

export interface MetaTag {
  name?: string;
  property?: string;
  content: string;
}

export interface MetaConfig {
  title: string;
  description?: string;
  keywords?: string;
  og?: {
    title?: string;
    description?: string;
    type?: string;
  };
  twitter?: {
    title?: string;
    description?: string;
    card?: string;
  };
}

type PageKey = keyof typeof metaConfig;

function createMetaTags(meta: MetaConfig): MetaTag[] {
  const tags: MetaTag[] = [];

  if (meta.description) {
    tags.push({ name: 'description', content: meta.description });
  }

  if (meta.keywords) {
    tags.push({ name: 'keywords', content: meta.keywords });
  }

  if (meta.og) {
    if (meta.og.title) {
      tags.push({ property: 'og:title', content: meta.og.title });
    }
    if (meta.og.description) {
      tags.push({ property: 'og:description', content: meta.og.description });
    }
    if (meta.og.type) {
      tags.push({ property: 'og:type', content: meta.og.type });
    }
  }

  if (meta.twitter) {
    if (meta.twitter.title) {
      tags.push({ name: 'twitter:title', content: meta.twitter.title });
    }
    if (meta.twitter.description) {
      tags.push({ name: 'twitter:description', content: meta.twitter.description });
    }
    if (meta.twitter.card) {
      tags.push({ name: 'twitter:card', content: meta.twitter.card });
    }
  }

  return tags;
}

function setMetaTag(tag: MetaTag): void {
  const { name, property, content } = tag;
  let existingTag: HTMLMetaElement | null = null;

  if (name) {
    existingTag = document.querySelector(`meta[name="${name}"]`);
  } else if (property) {
    existingTag = document.querySelector(`meta[property="${property}"]`);
  }

  if (existingTag) {
    existingTag.content = content;
  } else {
    const newTag = document.createElement('meta');
    if (name) {
      newTag.name = name;
    } else if (property) {
      newTag.setAttribute('property', property);
    }
    newTag.content = content;
    document.head.appendChild(newTag);
  }
}

function removeMetaTag(tag: MetaTag): void {
  const { name, property } = tag;
  let existingTag: HTMLMetaElement | null = null;

  if (name) {
    existingTag = document.querySelector(`meta[name="${name}"]`);
  } else if (property) {
    existingTag = document.querySelector(`meta[property="${property}"]`);
  }

  if (existingTag) {
    document.head.removeChild(existingTag);
  }
}

export function useMeta(pageKey: PageKey): void {
  useEffect(() => {
    const meta = metaConfig[pageKey];
    if (!meta) return;

    document.title = meta.title;

    const tags = createMetaTags(meta);
    tags.forEach(setMetaTag);

    return () => {
      tags.forEach(removeMetaTag);
    };
  }, [pageKey]);
}

export function useCustomMeta(customMeta: MetaConfig): void {
  useEffect(() => {
    document.title = customMeta.title;

    const tags = createMetaTags(customMeta);
    tags.forEach(setMetaTag);

    return () => {
      tags.forEach(removeMetaTag);
    };
  }, [customMeta]);
}

export { metaConfig };