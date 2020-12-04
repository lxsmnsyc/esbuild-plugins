import os from 'os';
import gql from 'graphql-tag';

const baseCode = `
  const names = {};
  function unique(defs) {
    return defs.filter(
      function(def) {
        if (def.kind !== 'FragmentDefinition') {
          return true;
        }
        const name = def.name.value
        if (names[name]) {
          return false;
        }
        names[name] = true;
        return true;
      }
    )
  }
`;

function expandImports(source: string) {
  const lines = source.split(/\r\n|\r|\n/);
  let outputCode = baseCode;

  // Collect imports
  const importFiles = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line[0] === '#' && line.slice(1).split(' ')[0] === 'import') {
      const importFile = line.slice(1).split(' ')[1];
      importFiles.push(importFile);
    }
    if (line.length !== 0 && line[0] !== '#') {
      break;
    }
  }

  let headerCode = '';

  importFiles.forEach((importFile, index) => {
    headerCode += `import File_${index} from ${importFile};${os.EOL}`;
  });
  outputCode = headerCode + outputCode + os.EOL;
  importFiles.forEach((_, index) => {
    const appendDef = `doc.definitions = doc.definitions.concat(unique(File_${index}.definitions));`;
    outputCode += appendDef + os.EOL;
  });

  return outputCode;
}

export default function loader(source: string): string {
  const doc = gql`${source}`;
  let headerCode = `const doc = ${JSON.stringify(doc)};${os.EOL}`;

  if (doc.loc) {
    headerCode += `doc.loc.source = ${JSON.stringify(doc.loc.source)};${os.EOL}`;
  }

  let outputCode = '';

  // Allow multiple query/mutation definitions in a file. This parses out dependencies
  // at compile time, and then uses those at load time to create minimal query documents
  // We cannot do the latter at compile time due to how the #import code works.
  const operationCount = doc.definitions.reduce((accum, op) => (
    (op.kind === 'OperationDefinition')
      ? accum + 1
      : accum
  ), 0);

  if (operationCount < 1) {
    outputCode += 'export default doc;';
  } else {
    outputCode += `

    // Collect any fragment/type references from a node, adding them to the refs Set
    function collectFragmentReferences(node, refs) {
      if (node.kind === 'FragmentSpread') {
        refs.add(node.name.value);
      } else if (node.kind === 'VariableDefinition') {
        const { type } = node;
        if (type.kind === 'NamedType') {
          refs.add(type.name.value);
        }
      }
      if (node.selectionSet) {
        node.selectionSet.selections.forEach(function(selection) {
          collectFragmentReferences(selection, refs);
        });
      }
      if (node.variableDefinitions) {
        node.variableDefinitions.forEach(function(def) {
          collectFragmentReferences(def, refs);
        });
      }
      if (node.definitions) {
        node.definitions.forEach(function(def) {
          collectFragmentReferences(def, refs);
        });
      }
    }
    const definitionRefs = {};
    doc.definitions.forEach(function(def) {
      if (def.name) {
        const refs = new Set();
        collectFragmentReferences(def, refs);
        definitionRefs[def.name.value] = refs;
      }
    });
    function findOperation(doc, name) {
      for (let i = 0; i < doc.definitions.length; i++) {
        const element = doc.definitions[i];
        if (element.name && element.name.value == name) {
          return element;
        }
      }
    }
    function oneQuery(doc, operationName) {
      // Copy the DocumentNode, but clear out the definitions
      const newDoc = {
        kind: doc.kind,
        definitions: [findOperation(doc, operationName)]
      };
      if (doc.hasOwnProperty('loc')) {
        newDoc.loc = doc.loc;
      }
      // Now, for the operation we're running, find any fragments referenced by
      // it or the fragments it references
      const opRefs = definitionRefs[operationName] || new Set();
      const allRefs = new Set();
      let newRefs = new Set();
      // IE 11 doesn't support 'new Set(iterable)', so we add the members of opRefs to newRefs one by one
      opRefs.forEach(function(refName) {
        newRefs.add(refName);
      });
      while (newRefs.size > 0) {
        const prevRefs = newRefs;
        newRefs = new Set();
        prevRefs.forEach(function(refName) {
          if (!allRefs.has(refName)) {
            allRefs.add(refName);
            const childRefs = definitionRefs[refName] || new Set();
            childRefs.forEach(function(childRef) {
              newRefs.add(childRef);
            });
          }
        });
      }
      allRefs.forEach(function(refName) {
        const op = findOperation(doc, refName);
        if (op) {
          newDoc.definitions.push(op);
        }
      });
      return newDoc;
    }
    export default doc;    
    `;

    for (let i = 0; i < doc.definitions.length; i += 1) {
      const op = doc.definitions[i];
      if (op.kind === 'OperationDefinition') {
        if (!op.name) {
          if (operationCount > 1) {
            throw new Error('Query/mutation names are required for a document with multiple definitions');
          }
        } else {
          const opName = op.name.value;
          outputCode += `export const ${opName} = oneQuery(doc, '${opName}');${os.EOL}`;
        }
      }
    }
  }

  const importOutputCode = expandImports(source);
  const allCode = headerCode + os.EOL + importOutputCode + os.EOL + outputCode + os.EOL;

  return allCode;
}
