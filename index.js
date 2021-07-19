const express = require('express')
const app = express()
const cors = require('cors')
const authRoute = require('./routes/authRoute')
const cookieParser = require('cookie-parser')
const {MONGOURL} = require('./config/keys')
const corsOptions = {
    origin:'http://localhost:3000',
    credentials: true,
    optionSuccessStatus: 200
}

app.use(cors(corsOptions))
app.use(express.json())
app.use(cookieParser())
app.use(authRoute)

if(process.env.NODE_ENV === "production"){
    app.use(express.static('client/build'))
    const path = require('path')
    app.get("*", (req,res)=>{
        res.sendFile(path.resolve(__dirname,'client','build','index.html'))
    })
}

const http = require('http').createServer(app)
const socketio = require('socket.io')
const io = socketio(http);
const mongoose = require('mongoose')
const {adduser,removeuser,getuser} = require('./helpers');
const Room = require('./models/Room');
const Message = require('./models/Message');
mongoose.connect(MONGOURL,{useNewUrlParser: true, useUnifiedTopology: true}).then(()=>console.log('connected successfully')).catch(err=> console.log(err))
const PORT = process.env.PORT || 5000;

app.get('/set-cookies',(req,res)=>{
    res.cookie('username','kioko')
    res.cookie('isAuthenticated',true,{ maxAge: 24 * 60 * 60 * 1000 })
    res.send('the cookies are set')
})
app.get('/get-cookies',(req,res)=>{
   const cookies = req.cookies;
   console.log(cookies);
   res.json(cookies);
})

io.on('connection', (socket)=>{
    console.log(socket.id)
    Room.find().then(result=>{
        socket.emit('output-rooms',result)
    })
    socket.on('create-room', name=>{
        //console.log('the room name created is ', name)
        const room = new Room({name})
        room.save().then(result=>{
            io.emit('room-created',result)
        })
    })
    socket.on('join',({name,user_id,room_id})=>{
        const {error,user} = adduser({
            socket_id: socket.id,
            name,
            room_id,
            user_id: user_id
        })
        socket.join(room_id);
        if(error){
            console.log('join error', error)
        }else{
            console.log('join user', user)
        }
    })
    socket.on('sendmessage',(message,room_id,callback)=>{
     const user = getuser(socket.id)
     const msgtostore = {
         name: user.name,
         user_id: user.user_id,
         room_id,
         text: message
     }
     console.log('message',msgtostore)
     const msg = new Message(msgtostore)
     msg.save().then(result=>{
        io.to(room_id).emit('message',result)
        callback()
     })
    })
    socket.on('get-messages-history', room_id => {
        Message.find({ room_id })
        .then(result => {
            socket.emit('output-messages', result)
        })
    })
    socket.on('disconnect',()=>{
        const user = removeuser(socket.id)
    })
});
http.listen(PORT,()=>{
    console.log(`listening on port : ${PORT}`)
})