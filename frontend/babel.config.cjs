module.exports = {
  presets: [
    ["@babel/preset-env", { targets: { node: "current" } }],
    ["@babel/preset-react", { runtime: "automatic" }],
  ],
  plugins: [
    // Transform import.meta.env → ({ env: process.env }) for Jest / Node
    ({ types: t }) => ({
      visitor: {
        MetaProperty(path) {
          if (
            path.node.meta.name === "import" &&
            path.node.property.name === "meta"
          ) {
            path.replaceWith(
              t.objectExpression([
                t.objectProperty(
                  t.identifier("env"),
                  t.memberExpression(
                    t.identifier("process"),
                    t.identifier("env"),
                  ),
                ),
              ]),
            );
          }
        },
      },
    }),
  ],
};
