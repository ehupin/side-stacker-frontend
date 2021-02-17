import React from 'react';
import classNames from "classnames";

const io = require("socket.io-client")

import './App.css';

const config = require('./config');

// define game statuses and related messages
const GameStatuses = Object.freeze({
  WaitingForConnection: {
    value: 0,
    message: 'Wait for connection to server...'
  },
  WaitingForOpponentToConnect: {
    value: 1,
    message: 'Wait for opponent connection...'
  },
  WaitingForPlayerMove: {
    value: 2,
    message: 'Play !'
  },
  WaitingForOpponentMove: {
    value: 3,
    message: 'Wait for opponent to play...'
  },
  PlayerWon: {
    value: 4,
    message: 'You win :)'
  },
  OpponentWon: {
    value: 5,
    message: 'You loose :('
  },
  Draw: {
    value: 6,
    message: 'Draw :/'
  },
})

const GameModes = {
  OnePlayer: 0,
  TwoPlayer: 1,
}


class App extends React.Component {
  constructor(props) {
    super(props);
    const socket = io(config.serverUrl)

    this.state = {
      gameMode: null,
      gameMatrix: [],
      socket,
      gameId: null,
      playerId: null,
      status: GameStatuses.WaitingForConnection.value
    };

    // wait for server connection and game to be joined
    const that = this
    socket.on('connect', function () {
      socket.on('player_joined_game', (data) => {

        // if current player is joining the game (i.e. not player id has been defined yet)
        if (that.state.playerId === null) {

          // create a matrix made of "null"
          const gameMatrix = Array.from(
            {length: data.game_matrix_size},
            e => Array.from(
              {length: data.game_matrix_size},
              e => null
            )
          );

          that.setState({
            playerId: data.player_id,
            gameId: data.game_id,
            gameMatrix,
          })
        }

        // update game status
        let status
        if (data.game_is_full) {
          status = that.state.playerId === 0 ? GameStatuses.WaitingForPlayerMove.value : GameStatuses.WaitingForOpponentMove.value
        } else {
          status = GameStatuses.WaitingForOpponentToConnect.value
        }
        that.setState({status})
      })
    });

    // update component when a piece is added
    socket.on('piece_added', (data) => {

      // duplicate and update game matrix
      const editedGameTable = [...this.state.gameMatrix]
      editedGameTable[data.row][data.column] = data.player_id

      // update game status
      let status
      if (data.game_is_draw) {
        status = GameStatuses.Draw.value
      } else if (data.game_is_won) {
        if (that.state.playerId === data.player_id) {
          status = GameStatuses.PlayerWon.value
        } else {
          status = GameStatuses.OpponentWon.value
        }
      } else {
        if (that.state.playerId === data.player_id) {
          status = GameStatuses.WaitingForOpponentMove.value
        } else {
          status = GameStatuses.WaitingForPlayerMove.value
        }
      }
      this.setState({gameMatrix: editedGameTable, status})
    })
  }


  joinGameClicked(gameMode) {
    this.state.gameMode = gameMode
    this.state.socket.emit('join', {gameMode})
  }

  render() {
    return (
      <div id="game">
        <div id="header">
          <div id="title">Side Stacker</div>
          {this.state.gameMode === null
            ? <StartupHeader joinFunction={this.joinGameClicked.bind(this)}/>
            : <GameBoard parentState={this.state}/>
          }

        </div>


      </div>
    )
  }

}

class StartupHeader extends React.Component {
  render() {
    return (
      <div>
        <div>
          <input type="button" className="joinButton" value="1 player"
                 onClick={() => this.props.joinFunction(GameModes.OnePlayer)}/>
          <input type="button" className="joinButton" value="2 player"
                 onClick={() => this.props.joinFunction(GameModes.TwoPlayer)}/>
        </div>
      </div>
    );
  }
}

class GameBoard extends React.Component {
  addButtonClicked(rowIndex, side) {
    // notify server for player move (if player is allowed to play)
    if (this.props.parentState.status === GameStatuses.WaitingForPlayerMove.value) {
      this.props.parentState.socket.emit('add_piece', {rowIndex, side})
    }
  }


  render() {
    // list playable row in game matrix (i.e. one with no remaining null values)
    const playableRows = []
    for (const row of this.props.parentState.gameMatrix) {
      const playable = row.indexOf(null) !== -1
      playableRows.push(playable)
    }

    // get status message from game status
    const statusKey = Object.keys(GameStatuses).find((key) => {
      return GameStatuses[key].value === this.props.parentState.status
    })
    const statusMessage = GameStatuses[statusKey].message

    // check if user can play
    const canPlay = this.props.parentState.status === GameStatuses.WaitingForPlayerMove.value


    return (
      <div>
        <div>
          <div id="details">
            <div>Game ID: {this.props.parentState.gameId}</div>
          </div>
          <div id="playerHeader">
            <PlayerInfo playerId={0} currentPlayer={this.props.parentState.playerId}/>
            <PlayerInfo playerId={1} currentPlayer={this.props.parentState.playerId}/>
          </div>
          <div id="info">
            {statusMessage}
          </div>
        </div>
        <div id="board">
          {this.props.parentState.gameMatrix.map((row, rowIndex) => (
            <div className='row' key={rowIndex}>

              <AddPieceButton side={0}
                              enabled={canPlay && playableRows[rowIndex]}
                              clickHandler={() => this.addButtonClicked(rowIndex, 0)}/>

              {row.map((column, columnIndex) => (
                <div key={columnIndex}
                     className={
                       classNames({
                         cell: true,
                         player0: this.props.parentState.gameMatrix[rowIndex][columnIndex] === 0,
                         player1: this.props.parentState.gameMatrix[rowIndex][columnIndex] === 1,
                       })
                     }>
                </div>
              ))}

              <AddPieceButton side={1}
                              enabled={canPlay && playableRows[rowIndex]}
                              clickHandler={() => this.addButtonClicked(rowIndex, 1)}/>
            </div>
          ))}
        </div>
      </div>

    )
  }
}

class PlayerInfo extends React.Component {
  render() {
    return (
      <div className={classNames({
        playerStats: true,
        player0: this.props.playerId === 0,
        player1: this.props.playerId === 1,
      })}>
        <div>
          Player {this.props.playerId + 1}
          {this.props.playerId === this.props.currentPlayer &&
          <span className="currentPlayerYouString">(you)</span>
          }
        </div>
      </div>
    );
  }
}

class AddPieceButton extends React.Component {
  render() {
    const symbol = this.props.side === 0 ? '▶' : '◀'
    return (
      <div className={classNames({button: true, enabled: this.props.enabled})}
           onClick={this.props.clickHandler}>
        {symbol}
      </div>
    );
  }
}

export default App;
