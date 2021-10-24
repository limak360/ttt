function sendMessages(request, response) {
    var message_text = request.body.message_text;
    var to = request.body.message_to_user_id;
    console.log(`Received message => ${message_text} from ${request.session.user_id} to ${to}`);

    User.findAll({ where: { user_id: to } }).then(
        users => {
            if (users.length >= 1) {
                var mes = {
                    message_from_user_id: 0,//TODO
                    message_to_user_id: users[0].user_id,
                    message_text: "", //TODO
                }
                var user = users[0];
                Message.create(mes)
                        .then((mes) => 
                        {
                            if (user.user_id in onlineUsers) {
                                // Wysyłanie wiadomości do użytkownika
                            }
                            if (mes.message_from_user_id !== mes.message_to_user_id) {
                                if (mes.message_from_user_id in onlineUsers) {
                                     // Wysyłanie wiadomości do samego siebie jeżeli użytkownik nie wysyła wiadomości do siebie.
                                }
                            }

                            response.send({ sending: true })
                        })
                        .catch(function (err) { console.log(err); response.send({ error: err })
                      });

            } else {
                response.send({ error: "User not exists" });
            }
        })
}


app.post('/api/messages/', [checkSessions, sendMessages]);