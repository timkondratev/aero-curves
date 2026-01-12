import { Plot } from "./Plot";

function App() {
  const width = window.innerWidth;
  const height = window.innerHeight * 0.7;

  return (
    <div>
      <Plot width={width} height={height} />
    </div>
  );
}

export default App;
