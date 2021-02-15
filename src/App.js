import React from 'react';
import classNames from "classnames";
const io = require("socket.io-client")

import './App.css';
const config = require('./config');

// define game statuses and related messages
const GameStatuses = Object.freeze({
  WaitingForConnection: {
    alue: 0,
    message: 'Wait for connection to server...'},
  WaitingForOpponentToConnect: {
    value: 1,
    message: 'Wait for opponent connection...'},
  WaitingForPlayerMove: {
    value: 2,
    message: 'Play !'},
  WaitingForOpponentMove: {
    value: 3,
    message: 'Wait for opponent to play...'},
  PlayerWon: {
    value: 4,
    message: 'You win :)'},
  OpponentWon: {
    value: 5,
    message: 'You loose :('},
  Draw: {
    value: 6,
    message: 'Draw :/'},
})


class App extends React.Component {
  constructor(props) {
    super(props);
    const socket = io(config.serverUrl)

    this.state = {
      gameMatrix: [],
      socket,
      gameId:null,
      playerId:null,
      status: GameStatuses.WaitingForConnection.value
    };

    // wait for server connection and game to be joined
    const that = this
    socket.on('connect', function() {
      socket.on('player_joined_game', (data)=>{

        // if current player is joining the game (i.e. not player id has been defined yet)
        if (that.state.playerId === null){

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
        if (data.game_is_full){
          status = that.state.playerId === 0 ? GameStatuses.WaitingForPlayerMove.value : GameStatuses.WaitingForOpponentMove.value
        } else {
          status = GameStatuses.WaitingForOpponentToConnect.value
        }
        that.setState({status})
      })
    });

    // update component when a piece is added
    socket.on('piece_added', (data)=>{

      // duplicate and update game matrix
      const editedGameTable = [...this.state.gameMatrix]
      editedGameTable[data.row][data.column] = data.player_id

      // update game status
      let status
      if (data.game_is_draw){
        status = GameStatuses.Draw.value
      } else if (data.game_is_won){
        if (that.state.playerId === data.player_id){
          status = GameStatuses.PlayerWon.value
        } else {
          status = GameStatuses.OpponentWon.value
        }
      } else {
        if (that.state.playerId === data.player_id){
          status = GameStatuses.WaitingForOpponentMove.value
        } else {
          status = GameStatuses.WaitingForPlayerMove.value
        }
      }
      this.setState({gameMatrix:editedGameTable, status})
    })
  }

  addButtonClicked(rowIndex, side){
    // notify server for player move (if player is allowed to play)
    if (this.state.status === GameStatuses.WaitingForPlayerMove.value){
      this.state.socket.emit('add_piece', {rowIndex, side})
    }
  }

  render() {
    // list playable row in game matrix (i.e. one with no remaining null values)
    const playableRows = []
    for (const row of this.state.gameMatrix){
      const playable = row.indexOf(null) !== -1
      playableRows.push(playable)
    }

    // get status message from game status
    const statusKey = Object.keys(GameStatuses).find((key) => {
      return GameStatuses[key].value === this.state.status
    })
    const statusMessage = GameStatuses[statusKey].message

    // check if user can play
    const canPlay = this.state.status === GameStatuses.WaitingForPlayerMove.value

    return (
      <div id="game">
        <div id="header">
          <div id="title">Side Stacker</div>
          <div id="details">
            <div>Game ID: {this.state.gameId}</div>
          </div>
          <div id="playerHeader">
            <PlayerInfo playerId={0} currentPlayer={this.state.playerId}/>
            <PlayerInfo playerId={1} currentPlayer={this.state.playerId}/>
          </div>
          <div id="info">
            {statusMessage}
          </div>
        </div>
        <div id="board">
          {this.state.gameMatrix.map((row, rowIndex) => (
            <div className='row' key={rowIndex}>

              <AddPieceButton side={0}
                              enabled={canPlay && playableRows[rowIndex]}
                              clickHandler={()=>this.addButtonClicked(rowIndex, 0)}/>

              {row.map((column, columnIndex) => (
                <div key={columnIndex}
                     className={
                       classNames({
                         cell: true,
                         player0: this.state.gameMatrix[rowIndex][columnIndex] === 0,
                         player1: this.state.gameMatrix[rowIndex][columnIndex] === 1,
                       })
                     }>
                </div>
              ))}

              <AddPieceButton side={1}
                              enabled={canPlay && playableRows[rowIndex]}
                              clickHandler={()=>this.addButtonClicked(rowIndex, 1)}/>
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
