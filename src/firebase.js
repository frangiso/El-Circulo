import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyBldyTGRtyG7VwqVpky8IaJMzRYLxbdkP0",
  authDomain: "el-circulo-a33fc.firebaseapp.com",
  projectId: "el-circulo-a33fc",
  storageBucket: "el-circulo-a33fc.firebasestorage.app",
  messagingSenderId: "213951313649",
  appId: "1:213951313649:web:120b5676364c75509f9b50"
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export default app
