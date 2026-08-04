// registry.js — samlar alla spelmoduler på ett ställe. Nya spel läggs
// till här; resten av appen (rooms.js/ui.js/main.js) är generisk över
// vilket spel som spelas och pratar bara med den här filen.

import * as tictactoe from "./tictactoe.js?v=32";
import * as othello from "./othello.js?v=32";
import * as backgammon from "./backgammon.js?v=32";
import * as battleship from "./battleship.js?v=32";
import * as connectfour from "./connectfour.js?v=32";
import * as checkers from "./checkers.js?v=32";

export const GAMES = {
    [tictactoe.meta.id]: tictactoe,
    [othello.meta.id]: othello,
    [backgammon.meta.id]: backgammon,
    [battleship.meta.id]: battleship,
    [connectfour.meta.id]: connectfour,
    [checkers.meta.id]: checkers,
};

export const GAME_LIST = [tictactoe, othello, backgammon, battleship, connectfour, checkers];

export const DEFAULT_GAME_ID = tictactoe.meta.id;

export function getGame(gameId) {
    return GAMES[gameId] || GAMES[DEFAULT_GAME_ID];
}
