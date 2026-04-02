import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut,
  createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../firebase'

const Ctx = createContext()
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [listo, setListo]   = useState(false)

  const login   = (e,p) => signInWithEmailAndPassword(auth, e, p)
  const logout  = async () => { await signOut(auth); setPerfil(null) }
  const resetPw = (e) => sendPasswordResetEmail(auth, e)

  async function registrar(email, pass, nombre, apellido, rol) {
    const c = await createUserWithEmailAndPassword(auth, email, pass)
    await setDoc(doc(db,'usuarios',c.user.uid), {
      nombre, apellido, email, rol, estado:'pendiente', creadoEn: serverTimestamp()
    })
    return c
  }

  useEffect(() => onAuthStateChanged(auth, async u => {
    setUser(u)
    if (u) {
      const s = await getDoc(doc(db,'usuarios',u.uid))
      setPerfil(s.exists() ? s.data() : null)
    } else { setPerfil(null) }
    setListo(true)
  }), [])

  return (
    <Ctx.Provider value={{ user, perfil, listo, login, logout, registrar, resetPw }}>
      {listo && children}
    </Ctx.Provider>
  )
}
