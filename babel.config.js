/** Babel config for Jest (babel-jest). Single file so all workers resolve the same config. */
// Syntax-only plugin ensures Babel never treats config as "no configuration data" in workers.
module.exports = {
  presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
  plugins: ['@babel/plugin-syntax-optional-chaining']
};
