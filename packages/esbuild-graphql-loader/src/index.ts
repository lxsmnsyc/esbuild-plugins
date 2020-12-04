import { Plugin } from 'esbuild';
import fs from 'fs-extra';
import path from 'path';
import loader from './loader';

const graphql: Plugin = {
  name: 'graphql-loader',
  setup(build) {
    build.onResolve({ filter: /\.(graphql|gql)$/i }, (args) => {
      const actualPath = path.resolve(path.dirname(args.importer), args.path);
      return ({
        path: actualPath,
        namespace: 'graphql-loader',
      });
    });

    build.onLoad({ filter: /\.(graphql|gql)$/i }, async (args) => {
      const source = await fs.readFile(args.path);
      return {
        contents: loader(source.toString()),
      };
    });
  },
};

export default graphql;
