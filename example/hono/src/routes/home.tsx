import { useState } from "react"

export default function Home() {
  const [count, setCount] = useState(1)

  return (
    <div>
      <h1>@stormory/react-router-server</h1>
      <p>Count: {count}</p>
      <button onClick={() => setCount(p => p + 1)}>Increase</button>
      <button onClick={() => setCount(p => p - 1)}>Decrease</button>
    </div>
  )
}
