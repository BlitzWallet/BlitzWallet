// tree.js pulls in UI + native modules; only its pure helpers are under test.
jest.mock('../../../app/functions/CustomElements', () => ({}));
jest.mock('../../../app/functions/CustomElements/scrollView', () => ({}));
jest.mock('../../../app/functions/CustomElements/button', () => ({}));
jest.mock('../../../app/functions/CustomElements/redesign/TopBar', () => ({}));
jest.mock('../../../app/functions/CustomElements/redesign/Note', () => ({}));
jest.mock('../../../app/functions/CustomElements/redesign/Spinner', () => ({}));
jest.mock('../../../app/functions/CustomElements/redesign/ListRow', () => ({}));
jest.mock(
  '../../../app/functions/CustomElements/redesign/useContentWidth',
  () => ({}),
);
jest.mock('../../../app/functions/CustomElements/textTheme', () => ({}));
jest.mock('../../../app/functions/CustomElements/themeIcon', () => ({}));
jest.mock('../../../app/functions/unilateralExit/exitBackup', () => ({}));
jest.mock('../../../app/functions/unilateralExit/exitEngine', () => ({}));
jest.mock('../../../app/constants', () => ({ FONT: {}, CENTER: {} }));
jest.mock('../../../context-store/theme', () => ({}));
jest.mock('../../../context-store/keys', () => ({}));

import {
  exitStages,
  stageRep,
} from '../../../app/components/admin/homeComponents/settingsContent/leaves/unilateralExit/tree';

const t = k => k;
const tx = (txid, kind, dependsOn = []) => ({
  txid,
  kind,
  dependsOn,
  status: { type: 'confirmed' },
});
const keys = stages => stages.map(s => s.key.split('.').pop());

describe('exitStages', () => {
  it('groups a fanOut tree into ordered stages', () => {
    const stages = exitStages(
      [
        tx('S', 'sweep', ['R1', 'R2']),
        tx('F', 'fanOut'),
        tx('B1', 'node', ['F']),
        tx('B2', 'node', ['F']),
        tx('L1', 'node', ['B1']),
        tx('L2', 'node', ['B2']),
        tx('R1', 'refund', ['L1']),
        tx('R2', 'refund', ['L2']),
      ],
      t,
    );
    expect(keys(stages)).toEqual([
      'nodeFanOut',
      'nodeBranch',
      'nodeLeaf',
      'nodeRefund',
      'nodeSweep',
    ]);
    expect(stages[1].txs.map(x => x.txid)).toEqual(['B1', 'B2']);
  });

  it('shared branch with uneven depth puts each tx in one stage', () => {
    const input = [
      tx('N0', 'node'),
      tx('B1', 'node', ['N0']),
      tx('L1', 'node', ['B1']),
      tx('L2', 'node', ['B1']),
      tx('L3', 'node', ['N0']),
      tx('R1', 'refund', ['L1']),
      tx('R2', 'refund', ['L2']),
      tx('R3', 'refund', ['L3']),
    ];
    const stages = exitStages(input, t);
    const all = stages.flatMap(s => s.txs.map(x => x.txid));
    expect(all.length).toBe(input.length);
    expect(new Set(all)).toEqual(new Set(input.map(x => x.txid)));
    expect(
      stages
        .find(s => s.key === 'nodeLeaf')
        .txs.map(x => x.txid)
        .sort(),
    ).toEqual(['L1', 'L2', 'L3']);
    const order = keys(stages);
    expect(order.indexOf('nodeRoot')).toBeLessThan(order.indexOf('nodeBranch'));
    expect(order.indexOf('nodeBranch')).toBeLessThan(order.indexOf('nodeLeaf'));
  });

  it('same-depth leaf and branch keep process order regardless of input order', () => {
    const stages = exitStages(
      [
        tx('N0', 'node'),
        tx('L1', 'node', ['N0']),
        tx('B1', 'node', ['N0']),
        tx('L2', 'node', ['B1']),
        tx('R1', 'refund', ['L1']),
        tx('R2', 'refund', ['L2']),
      ],
      t,
    );
    expect(keys(stages)).toEqual([
      'nodeRoot',
      'nodeBranch',
      'nodeLeaf',
      'nodeRefund',
    ]);
  });

  it('empty input returns []', () => {
    expect(exitStages([], t)).toEqual([]);
  });
});

describe('stageRep', () => {
  const lock = (txid, at) => ({
    txid,
    status: { type: 'waitingForTimelock', spendableAtHeight: at },
  });

  it('timelocked stage speaks for its latest leaf, not the soonest', () => {
    expect(
      stageRep([lock('a', 1100), lock('b', 1600), lock('c', 1300)]).txid,
    ).toBe('b');
  });

  it('a timelock with a known height beats one with none', () => {
    expect(stageRep([lock('a', null), lock('b', 1100)]).txid).toBe('b');
  });
});
