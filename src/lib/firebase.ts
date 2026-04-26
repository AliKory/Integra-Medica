import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAQCjJES-F0aS7cb6T2U_iVglUThVEe1lU",
  authDomain: "integramedica-5f5da.firebaseapp.com",
  projectId: "integramedica-5f5da",
  storageBucket: "integramedica-5f5da.firebasestorage.app",
  messagingSenderId: "774658168996",
  appId: "1:774658168996:web:0a6ef22802838664396e31",
  measurementId: "G-KWT29MPHD3"
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

auth = getAuth(app);
db = getFirestore(app);
storage = getStorage(app);

export { app, auth, db, storage };
