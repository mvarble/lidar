import { defineConfig } from '@mvarble/mesearch';

export default defineConfig({
    // The site's name, shown on the home page and in every tab.
    title: 'LiDAR',
    // author: 'Your name',
    // lang: 'en',

    // The URL prefix the site is served from, if not the root of its domain,
    // as in GitHub Pages' '/<repository>'.
    // base: '/notes',

    // KaTeX macros every document can use. A document adds its own in its
    // frontmatter, under `katex_macros`.
    katexMacros: {
        '\\PP': '\\mathbb{P}',
        '\\EE': '\\mathbb{E}',
        '\\SO': '\\mathrm{SO}',
        '\\SE': '\\mathrm{SE}',
        '\\T': '^{\\top}',
    },

    // How the map lays itself out.
    graph: { charge: -2000, linkDistance: 200, gravity: 0.02 },
});
