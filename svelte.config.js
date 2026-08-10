import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = { kit: { adapter: adapter() , alias:{
   "$assets": 'src/lib/assets',
}} };

export default config;
