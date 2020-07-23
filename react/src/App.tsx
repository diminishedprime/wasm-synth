import React from "react";
import { FmOsc } from "wasm/pkg/wasm_part";

const NoteOff = 0x80;
const NoteOn = 0x90;
const ControlChange = 0xb0;

// TODO - add in functionality to choose midi input.
const useMidi = () => {
  const [midiAccess, setMidiAccess] = React.useState<WebMidi.MIDIAccess>();
  const [inputDevices, setInputDevices] = React.useState<WebMidi.MIDIInput[]>(
    []
  );
  const [activeInput, setInputDevice] = React.useState<WebMidi.MIDIInput>();
  const [activeNotes, setActiveNotes] = React.useState<[number, number][]>([]);
  const [modWheel, setModWheel] = React.useState(0);
  const [breathController, setBreathController] = React.useState(0);

  React.useEffect(() => {
    window.navigator.requestMIDIAccess().then((midi) => {
      setMidiAccess(midi);
      midi.onstatechange = (e) => {
        console.log(e.port.name, e.port.manufacturer, e.port.state);
      };
    });
  }, []);

  React.useEffect(() => {
    if (midiAccess === undefined) {
      return;
    }
    const inputs = [];
    const inputsIter = midiAccess.inputs.values();
    for (
      let input = inputsIter.next();
      input && !input.done;
      input = inputsIter.next()
    ) {
      inputs.push(input.value);
    }
    setInputDevices(inputs);
    if (inputs.length > 0) {
      if (inputs.length > 1) {
        setInputDevice(inputs[1]);
      } else {
        setInputDevice(inputs[0]);
      }
    }
  }, [midiAccess]);

  React.useEffect(() => {
    if (activeInput !== undefined) {
      const onMidiMessage = (event: WebMidi.MIDIMessageEvent) => {
        const cmd = event.data[0];
        const pitch = event.data[1];
        const velocity = event.data.length > 2 ? event.data[2] : 1;

        switch (cmd) {
          case NoteOn:
            console.log("note added", pitch);
            setActiveNotes((old) => [[pitch, velocity], ...old]);
            break;
          case NoteOff:
            console.log("note removed", pitch);
            setActiveNotes((old) => old.filter(([p, _v]) => p !== pitch));
            break;
          case ControlChange:
            console.log("control change");
            console.log(event.data[1].toString(16));
            const ctrlNumber = event.data[1];
            const value = event.data[2];
            switch (ctrlNumber) {
              case 1:
                setModWheel(value);
                break;
              case 2:
                setBreathController(value);
                break;
              default:
                break;
            }
            break;
          default:
            console.log(`cmd: ${cmd.toString(16)} not handled`);
            console.log(event.data);
            break;
        }
      };
      activeInput.addEventListener("midimessage", onMidiMessage);
      return () =>
        activeInput.removeEventListener("midimessage", onMidiMessage as any);
    }
  }, [activeInput]);

  return {
    midiAccess,
    inputDevices,
    activeInput,
    activeNotes,
    modWheel,
    breathController,
  };
};

const App: React.FC = () => {
  const [wasm, setWasm] = React.useState<typeof import("wasm/pkg")>();
  const [osc, setOsc] = React.useState<FmOsc>();
  const [note, setNote] = React.useState<number>(50);
  const [gain, setGain] = React.useState<number>(0);

  const { activeNotes, modWheel, breathController } = useMidi();

  React.useEffect(() => {
    if (osc === undefined) return;
    osc.set_fm_amount(modWheel / 127);
  }, [modWheel, osc]);

  React.useEffect(() => {
    if (osc === undefined) return;
    osc.set_fm_frequency(breathController / 127);
  }, [breathController, osc]);

  React.useEffect(() => {
    if (activeNotes.length === 0) {
      setGain(0);
    } else {
      const entry = activeNotes[0];
      setNote(entry[0]);
      setGain(entry[1]);
    }
  }, [activeNotes, setNote, setGain]);

  React.useEffect(() => {
    (async () => {
      try {
        const wasmImport = await import("wasm/pkg");
        setWasm(wasmImport);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  React.useEffect(() => {
    if (osc === undefined) {
      return;
    }
    if (note === undefined) {
      return;
    }

    osc.set_note(note);
  }, [note, osc]);
  React.useEffect(() => {
    if (osc === undefined) {
      return;
    }
    if (note === undefined) {
      return;
    }
    osc.set_gain(gain);
  }, [gain]);

  React.useEffect(() => {
    if (wasm === undefined) return;
    const initialOsc = new wasm.FmOsc();
    setOsc(initialOsc);
    setGain(0);
  }, [wasm]);

  const toggleNote = React.useCallback(() => {
    if (wasm === undefined) {
      return;
    }
    if (osc === undefined) {
      const initialOsc = new wasm.FmOsc();
      setOsc(initialOsc);
      setNote(100);
      setGain(0.8);
    } else {
      osc.free();
      setOsc(undefined);
    }
  }, [wasm, osc]);

  if (wasm === undefined) {
    return <div>Loading wasm...</div>;
  }

  return (
    <div className="App">
      <table>
        <thead>
          <tr>
            <th>Note</th>
            <th>Fm Amount</th>
            <th>Fm Frequency</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{note}</td>
            <td>{(modWheel / 127).toFixed(2)}</td>
            <td>{(breathController / 127).toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
      <button onClick={toggleNote}>Toggle Note</button>
      <button onClick={() => setNote((a) => (a === undefined ? a : a + 1))}>
        Higher
      </button>
      <button onClick={() => setNote((a) => (a === undefined ? a : a - 1))}>
        {" "}
        Lower
      </button>
    </div>
  );
};

export default App;
