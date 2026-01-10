import { Graph } from "./Graph";

function App() {
  const width = window.innerWidth * 0.5;
  const height = window.innerHeight * 0.25;

  return (
    <div>
      <Graph width={width} height={height} />
    </div>
  );
}

export default App;
