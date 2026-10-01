import { useEffect } from 'react'
import { setMusicWanted, sfx } from './audio/audio'
import { go, showToast, useRoute } from './lib/ui'
import { Login } from './screens/Login'
import { Overlays, Toasts } from './screens/Overlays'
import { RoomScreen } from './screens/Room'
import { Shell } from './screens/Shell'
import { onUiEvent } from './sim/events'
import { startEngine, useWorld } from './sim/store'

export default function App() {
  const w = useWorld()
  const route = useRoute()
  const loggedIn = !!w.meId

  useEffect(() => {
    startEngine()
    return onUiEvent((e) => {
      if (e.type === 'toast') showToast(e.text, e.tone, e.pid)
      else if (e.type === 'sfx') sfx(e.name)
      else if (e.type === 'room-closed') {
        if (location.hash === `#/room/${e.roomId}`) {
          showToast(`Room #${e.roomId} has closed`)
          go('lobby')
        }
      }
    })
  }, [])

  // lobby music is for the lobby only: it fades out inside a game room
  useEffect(() => {
    setMusicWanted(loggedIn && route.name !== 'room')
  }, [loggedIn, route.name])

  if (!loggedIn)
    return (
      <>
        <Login />
        <Toasts />
      </>
    )
  return (
    <>
      {route.name === 'room' ? <RoomScreen key={route.id} id={route.id} /> : <Shell route={route} />}
      <Overlays />
    </>
  )
}
