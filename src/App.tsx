import { Plot } from "./Plot";

function App() {
  const width = window.innerWidth * 0.5;
  const height = window.innerHeight * 0.25;

  return (
    <div>
      <Plot width={width} height={height} />
    </div>
  );
}

export default App;
