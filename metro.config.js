const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

config.resolver.blockList = [/\/backend\/.*/];

// expo-sqlite (web) importa um binário .wasm. No modo `expo export` o Metro
// precisa tratar .wasm como ASSET (senão falha ao "resolver o módulo"). O SQLite
// em si só roda no nativo — na web o acesso é bloqueado em runtime (src/db/migrations.ts).
config.resolver.assetExts.push('wasm');

module.exports = withNativeWind(config, { input: './global.css' });
