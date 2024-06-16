// strana klienta

const socket = io();
let chatId = null; 
const userId = window.userId; 

// Zpracování nové zprávy
socket.on('newMessage', (message) => {
    if (message.chat_id === chatId) { // Kontrola, zda zpráva patří do aktuálního chatu
        const messageElement = document.createElement('div'); // Vytvoření HTML prvku pro zprávu
        messageElement.classList.add('message'); // Přidání třídy pro zprávu
        messageElement.dataset.id = message.id; // Nastavení ID zprávy

        // Rozlišení zpráv podle odesílatele
        if (message.user_id === userId) {
            messageElement.classList.add('my-message'); // Moje zpráva
        } else {
            messageElement.classList.add('other-message'); // Zpráva od jiného uživatele
        }

        // Zpracování souboru ve zprávě
        if (message.file_url) {
            messageElement.innerHTML = `<a href="${message.file_url}" target="_blank">${message.content}</a>`;
        } else {
            messageElement.textContent = `${message.content}`;
        }

        // Přidání posluchače pro otevření okna možností pro moji zprávu
        if (message.user_id === userId) {
            messageElement.addEventListener('click', (event) => openMessageOptions(event, message, messageElement));
        }

        document.getElementById('messages').appendChild(messageElement);
        scrollToBottom(); 
    }
});

// aktualizace zprávy
socket.on('messageUpdated', ({ id, content }) => {
    const messageElement = document.querySelector(`.message[data-id="${id}"]`);
    if (messageElement) {
        messageElement.textContent = content;
    }
});

// smazání zprávy
socket.on('messageDeleted', ({ id }) => {
    const messageElement = document.querySelector(`.message[data-id="${id}"]`);
    if (messageElement) {
        messageElement.remove(); // Smazání zprávy z DOM
    }
});

// smazání chatu
socket.on('chatDeleted', ({ chatId: deletedChatId }) => {
    console.log(`Received chatDeleted event for chatId: ${deletedChatId}`);

    const chatElement = document.querySelector(`[data-chat-id="${deletedChatId}"]`);
    if (chatElement) {
        chatElement.remove(); // Odstranění prvku chatu
    } else {
        console.warn(`Chat element with chatId ${deletedChatId} not found.`);
    }

    // Pokud byl smazaný chat aktuálně otevřený, vymažeme ho z rozhraní
    if (deletedChatId === chatId) {
        console.log(`Chat with chatId ${deletedChatId} is currently open. Clearing the chat interface.`);
        document.getElementById('chatTitle').textContent = 'Chat'; // Reset názvu chatu
        document.getElementById('messages').innerHTML = 'This chat was deleted.'; // Vymazání zpráv
        chatId = null; // Reset aktuálního chatId
    } else {
        console.log(`Chat with chatId ${deletedChatId} is not currently open.`);
    }
});

// Zpracování vytvoření nového chatu
socket.on('newChat', ({ chatId, chatName, otherUserId, otherUserName }) => {
    const chatList = document.getElementById('chatList');

    const chatElement = document.createElement('div');
    chatElement.classList.add('chat-item');
    chatElement.dataset.chatId = chatId;
    chatElement.textContent = otherUserName;

    const deleteButton = document.createElement('button');
    deleteButton.classList.add('delete-chat-button');
    deleteButton.textContent = 'Delete';
    deleteButton.dataset.chatId = chatId;
    deleteButton.addEventListener('click', () => deleteChat(chatId));

    chatElement.appendChild(deleteButton);
    chatElement.addEventListener('click', () => selectChat(chatId, otherUserName));
    chatList.appendChild(chatElement);
});

// Hledání uživatelů na základě zadaného jména
document.getElementById('searchUserForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const username = document.getElementById('searchUsername').value;
    try {
        const response = await fetch(`/users?username=${encodeURIComponent(username)}`);
        const users = await response.json();
        const resultsDiv = document.getElementById('userResults');
        resultsDiv.innerHTML = '';
        if (users.length === 0) {
            resultsDiv.textContent = 'No users found.'; 
        } else {
            users.forEach(user => {
                const userElement = document.createElement('div');
                userElement.textContent = `User: ${user.username}`;
                userElement.addEventListener('click', () => {
                    openChat(user.id, user.username); // Otevření chatu s vybraným uživatelem
                });
                resultsDiv.appendChild(userElement);
            });
        }
    } catch (error) {
        console.error('Error searching user:', error);
        alert('Failed to search user.'); // Chybová zpráva při hledání uživatele
    }
});

// Resetování názvu souboru po výběru
function resetFileName() {
    document.getElementById('fileName').textContent = 'No file selected';
}

// Odeslání zprávy nebo souboru
document.getElementById('sendButton').addEventListener('click', async () => {
    const content = document.getElementById('messageInput').value;
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];

    if (chatId && (content.trim() !== '' || file)) {
        if (file) {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('chatId', chatId);
            formData.append('userId', userId);

            try {
                const response = await fetch('/upload', {
                    method: 'POST',
                    body: formData
                });
                const data = await response.json();
                
                if (data.success) {
                    const messageElement = document.createElement('div');
                    messageElement.classList.add('message', 'my-message');
                    messageElement.dataset.id = data.message.id;
                    messageElement.innerHTML = `<a href="${data.message.file_url}" target="_blank">${file.name}</a>`;
                    document.getElementById('messages').appendChild(messageElement);

                    fileInput.value = '';
                    resetFileName();
                    scrollToBottom();
                } else {
                    alert('Failed to upload file.'); 
                }
            } catch (error) {
                console.error('Error uploading file:', error);
                alert('Failed to upload file.');
            }
        } else {
            socket.emit('sendMessage', { chatId, content, userId }); // Odeslání textové zprávy
            document.getElementById('messageInput').value = '';
        }
    } else {
        alert('Please select a chat and type a message or choose a file.');
    }
});

// Aktualizace názvu souboru po jeho výběru
document.getElementById('fileInput').addEventListener('change', function() {
    const fileName = this.files[0] ? this.files[0].name : 'No file selected';
    document.getElementById('fileName').textContent = fileName;
});

// Otevření okna možností zprávy
function openMessageOptions(event, message, messageElement) {
    // Odstranění starého okna možností, pokud existuje
    const existingOptions = document.querySelector('.message-options');
    if (existingOptions) existingOptions.remove();

    // Vytvoření nového okna
    const messageOptions = document.createElement('div');
    messageOptions.classList.add('message-options');

    const editButton = document.createElement('button');
    editButton.textContent = 'Edit';
    editButton.addEventListener('click', () => {
        editMessage(message, messageOptions);
        messageOptions.remove(); // Odstranění okna možností po editaci
    });

    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', () => {
        deleteMessage(message.id, messageOptions);
        messageOptions.remove(); // Odstranění okna možností po smazání
    });

    messageOptions.appendChild(editButton);
    messageOptions.appendChild(deleteButton);
    document.body.appendChild(messageOptions);

    // Nastavení pozice okna
    messageOptions.style.position = 'absolute';
    messageOptions.style.top = `${event.clientY}px`;
    messageOptions.style.left = `${event.clientX}px`;
    messageOptions.style.zIndex = 1000;

    // Uzavření okna při kliknutí mimo něj
    const closeOptions = (e) => {
        if (!messageOptions.contains(e.target) && e.target !== messageElement) {
            messageOptions.remove();
            document.removeEventListener('click', closeOptions); 
        }
    };

    // Použití setTimeout, aby se zabránilo okamžitému uzavření okna kvůli kliknutí na prvek
    setTimeout(() => {
        document.addEventListener('click', closeOptions);
    }, 0);
}

// Editace zprávy
function editMessage(message, optionsElement) {
    const newContent = prompt('Edit your message:', message.content);
    if (newContent !== null && newContent !== '') {
        fetch(`/messages/${message.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ content: newContent })
        }).then(response => {
            if (response.ok) {
                document.querySelector(`.message[data-id="${message.id}"]`).textContent = newContent;
                optionsElement.remove();
            } else {
                alert('Failed to edit message'); // Zpráva při selhání editace
            }
        }).catch(error => console.error('Error editing message:', error));
    }
}

// Smazání zprávy
function deleteMessage(messageId, optionsElement) {
    console.log(`Attempting to delete message with id: ${messageId}`);
    if (confirm('Are you sure you want to delete this message?')) {
        fetch(`/messages/${messageId}`, {
            method: 'DELETE'
        }).then(response => {
            if (response.ok) {
                console.log(`Message with id ${messageId} deleted successfully`);
                const messageElement = document.querySelector(`.message[data-id="${messageId}"]`);
                if (messageElement) {
                    messageElement.remove();
                    console.log(`Message element with id ${messageId} removed from DOM`);
                } else {
                    console.warn(`Message element with id ${messageId} not found in DOM`);
                }
                optionsElement.remove();
            } else {
                console.error('Failed to delete message, response not ok');
                alert('Failed to delete message');
            }
        }).catch(error => {
            console.error('Error deleting message:', error);
        });
    }
}

// Funkce pro otevření chatu
async function openChat(otherUserId, otherUsername) {
    try {
        const response = await fetch('/chats/private', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId, otherUserId })
        });
        const { chatId: newChatId } = await response.json();
        chatId = newChatId;

        document.getElementById('chatTitle').textContent = `Chat with ${otherUsername}`;
        loadMessages(chatId);
        socket.emit('joinChat', chatId);
        loadChats();
    } catch (error) {
        console.error('Error opening chat:', error);
        alert('Failed to open chat.');
    }
}

// Funkce pro načtení chatů uživatele
async function loadChats() {
    try {
        const response = await fetch('/my-chats');
        const chats = await response.json();
        const chatList = document.getElementById('chatList');
        chatList.innerHTML = '';
        chats.forEach(chat => {
            const chatElement = document.createElement('div');
            chatElement.classList.add('chat-item');
            chatElement.dataset.chatId = chat.chat_id;
            chatElement.textContent = chat.otherUserName;

            const deleteButton = document.createElement('button');
            deleteButton.classList.add('delete-chat-button');
            deleteButton.textContent = 'Delete';
            deleteButton.dataset.chatId = chat.chat_id;
            deleteButton.addEventListener('click', () => deleteChat(chat.chat_id));

            chatElement.appendChild(deleteButton);
            chatElement.addEventListener('click', () => selectChat(chat.chat_id, chat.otherUserName));
            chatList.appendChild(chatElement);
        });
    } catch (error) {
        console.error('Error loading chats:', error);
    }
}

// Výběr chatu a načtení zpráv
async function selectChat(selectedChatId, chatName) {
    chatId = selectedChatId;
    document.getElementById('chatTitle').textContent = `Chat with ${chatName}`;
    await loadMessages(chatId);
    socket.emit('joinChat', chatId);
}

// Načtení zpráv pro vybraný chat
async function loadMessages(chatId) {
    try {
        const response = await fetch(`/chats/${chatId}/messages`);
        const messages = await response.json();
        const messagesDiv = document.getElementById('messages');
        messagesDiv.innerHTML = '';

        messages.forEach(message => {
            const messageElement = document.createElement('div');
            messageElement.classList.add('message');
            messageElement.dataset.id = message.id;

            if (message.user_id === userId) {
                messageElement.classList.add('my-message');
                messageElement.addEventListener('click', (event) => openMessageOptions(event, message, messageElement));
            } else {
                messageElement.classList.add('other-message');
            }

            if (message.file_url) {
                messageElement.innerHTML = `<a href="${message.file_url}" target="_blank">${message.content}</a>`;
            } else {
                messageElement.textContent = message.content;
            }
            messagesDiv.appendChild(messageElement);
        });
        scrollToBottom(); // Posunutí na konec zpráv
    } catch (error) {
        console.error('Error loading messages:', error);
    }
}

// Funkce pro posunutí na konec zpráv
function scrollToBottom() {
    const messagesDiv = document.getElementById('messages');
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Funkce pro smazání chatu
async function deleteChat(chatToDeleteId) {
    if (confirm('Are you sure you want to delete this chat?')) {
        try {
            const response = await fetch(`/chats/${chatToDeleteId}`, {
                method: 'DELETE'
            });
            const result = await response.json();

            if (result.success) {
                alert('Chat successfully deleted.');

                // Vymazání okna chatu, pokud byl smazaný chat aktuálně otevřen
                if (chatToDeleteId === chatId) {
                    document.getElementById('messages').innerHTML = 'This chat was deleted.';
                    document.getElementById('chatTitle').textContent = 'Chat';
                    chatId = null;
                }

                 // Odeslání události o smazání chatu
                 socket.emit('chatDeleted', { chatId: chatToDeleteId });
            } else {
                alert('Failed to delete chat: ' + result.error);
            }
        } catch (error) {
            console.error('Error deleting chat:', error);
            alert('An error occurred while deleting the chat.');
        }
    }
}

// Načtení chatů po načtení dokumentu
document.addEventListener('DOMContentLoaded', () => {
    loadChats();
});
