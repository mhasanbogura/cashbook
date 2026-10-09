// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBLLk7gabiWWMRo4B8KSOqc8QQR4ZdjkqM",
  authDomain: "cash-book-c68e7.firebaseapp.com",
  databaseURL: "https://cash-book-c68e7-default-rtdb.firebaseio.com",
  projectId: "cash-book-c68e7",
  storageBucket: "cash-book-c68e7.firebasestorage.app",
  messagingSenderId: "827541453098",
  appId: "1:827541453098:web:c5e0d31e1c8e87f3428653",
  measurementId: "G-J1MZT27F3X"
};

firebase.initializeApp(firebaseConfig);
var auth = firebase.auth();
var db = firebase.database();
