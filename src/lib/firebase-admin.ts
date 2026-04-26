
import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getAuth, Auth } from "firebase-admin/auth";
import { getFirestore, Firestore } from "firebase-admin/firestore";

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  // El reemplazo de \n es vital para que Windows/Vercel lean bien la llave
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n")
};

let app: App;

if (!getApps().length) {
  app = initializeApp({
    credential: cert(serviceAccount),
  });
} else {
  app = getApps()[0];
}

export const adminAuth: Auth = getAuth(app);
export const adminDb: Firestore = getFirestore(app);