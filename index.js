var express = require('express'),
  cluster = require('cluster'),
  sio_redis = require('socket.io-redis'),
  http = require('http')

var port = 3000,
  num_processes = 2 // test with 1 or 2

const log = function() {
  console.log.apply(
    this,
    ['PID:', process.pid, '-'].concat(Object.values(arguments))
  )
}

if (cluster.isMaster) {
  // This stores our workers. We need to keep them to be able to reference
  // them based on source IP address. It's also useful for auto-restart,
  // for example.
  var workers = []

  // Helper function for spawning worker at index 'i'.
  var spawn = function(i) {
    workers[i] = cluster.fork()

    // Optional: Restart worker on exit
    workers[i].on('exit', function(code, signal) {
      log('respawning worker', i)
      spawn(i)
    })
  }

  // Spawn workers.
  for (var i = 0; i < num_processes; i++) {
    spawn(i)
  }
} else {
  // Note we don't use a port here because the master listens on it for us.
  log('Forker stated -> http://localhost:3000')
  var app = new express()
  var server = app.listen(port)

  // Here create public folder to insert html test pages
  app.use(express.static(__dirname + '/public'))

  // Here simple get request
  app.get('/welcome-here', function(req, res) {
    log('Receive HTTP GET => welcome')
    res.send('You too')
  })

  // Here you might use middleware, attach routes, etc.

  // Don't expose our internal server to the outside.
  var io = require('socket.io').listen(server)

  // add cors
  io.origins(['http://localhost:3000'])

  // Tell Socket.IO to use the redis adapter. By default, the redis
  // server is assumed to be on localhost:6379. You don't have to
  // specify them explicitly unless you want to change them.
  io.adapter(sio_redis({ host: 'localhost', port: 6379 }))

  // add socket listener
  io.on('connection', function(socket) {
    log('new socket', socket.id)

    socket.on('ping-client', function() {
      log('receive: ping-client')

      setTimeout(() => {
        log('sent: ping-server')
        socket.emit('ping-server')
      }, 1000)
    })
  })
}
