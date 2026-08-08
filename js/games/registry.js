// registry.js — samlar alla spelmoduler på ett ställe. Nya spel läggs
// till här; resten av appen (rooms.js/ui.js/main.js) är generisk över
// vilket spel som spelas och pratar bara med den här filen.

import * as tictactoe from "./tictactoe.js?v=37";
import * as othello from "./othello.js?v=37";
import * as backgammon from "./backgammon.js?v=37";
import * as battleship from "./battleship.js?v=37";
import * as connectfour from "./connectfour.js?v=37";
import * as checkers from "./checkers.js?v=37";
import * as go from "./go.js?v=37";
import * as kvarn from "./kvarn.js?v=37";

export const GAMES = {
    [tictactoe.meta.id]: tictactoe,
    [othello.meta.id]: othello,
    [backgammon.meta.id]: backgammon,
    [battleship.meta.id]: battleship,
    [connectfour.meta.id]: connectfour,
    [checkers.meta.id]: checkers,
    [go.meta.id]: go,
    [kvarn.meta.id]: kvarn,
};

export const GAME_LIST = [tictactoe, othello, backgammon, battleship, connectfour, checkers, go, kvarn];

export const DEFAULT_GAME_ID = tictactoe.meta.id;

export function getGame(gameId) {
    return GAMES[gameId] || GAMES[DEFAULT_GAME_ID];
}
