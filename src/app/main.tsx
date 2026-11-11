import { render } from 'preact';
import '../ui/ui.css';
import { App } from '../ui/App';
import { bindKeyboard } from '../ui/controls';
import { startView } from '../view/scene';
import { game } from './game';

startView(document.getElementById('stage')!);
render(<App />, document.getElementById('ui')!);
bindKeyboard();
// 调试和自动测试用：让脚本能读到状态。不参与任何玩法。
(window as unknown as { __game: typeof game }).__game = game;
