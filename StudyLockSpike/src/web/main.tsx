import { AppRegistry } from 'react-native';
import App from '../../App';
import { name as appName } from '../../app.json';

declare global {
  var __GEN_STUDY_API_URL__: string | undefined;
  var __GEN_STUDY_API_TOKEN__: string | undefined;
}

globalThis.__GEN_STUDY_API_URL__ = import.meta.env.VITE_GEN_STUDY_API_URL;
globalThis.__GEN_STUDY_API_TOKEN__ = import.meta.env.VITE_GEN_STUDY_API_TOKEN;

AppRegistry.registerComponent(appName, () => App);
AppRegistry.runApplication(appName, {
  rootTag: document.getElementById('root'),
});
