import { isAudioMuteShortcut } from '../src/ui/Interface';
import { expect, it } from 'vitest';
import { inputFromKeys, isSwimMovementKey } from '../src/controls/SwimControls';
it('ignores Space and both Shift keys and retains only W/S/A/D movement', () => {
  const out = { forward: 0, right: 0 };
  for (const code of ['Space', 'ShiftLeft', 'ShiftRight'])
    expect(isSwimMovementKey(code)).toBe(false);
  inputFromKeys(new Set(['Space', 'ShiftLeft', 'ShiftRight']), out);
  expect(out).toEqual({ forward: 0, right: 0 });
  inputFromKeys(new Set(['KeyW', 'KeyD', 'Space', 'ShiftLeft']), out);
  expect(out).toEqual({ forward: 1, right: 1 });
  inputFromKeys(new Set(['KeyW', 'KeyS', 'KeyA', 'ShiftLeft']), out);
  expect(out).toEqual({ forward: 0, right: -1 });
});

it('reserves mute for an unmodified, non-repeating M key', () => {
  const plain = {
    code: 'KeyM',
    repeat: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
  };
  expect(isAudioMuteShortcut(plain)).toBe(true);
  for (const key of ['repeat', 'ctrlKey', 'metaKey', 'altKey'] as const)
    expect(isAudioMuteShortcut({ ...plain, [key]: true })).toBe(false);
  expect(isAudioMuteShortcut({ ...plain, code: 'KeyN' })).toBe(false);
});
