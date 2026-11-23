// The CSV export includes payer-supplied payment descriptions. Ways it can be
// abused when the user opens the file in a spreadsheet:
//  1. A description starting with = + - @ (or tab/CR) runs as a formula.
//  2. Neutralizing also mangles ordinary descriptions.
const base = '../../app/components/admin/homeComponents/exportTransactions';
jest.mock('../../app/functions/CustomElements', () => ({}));
jest.mock('../../app/hooks/themeColors', () => jest.fn());
jest.mock('../../app/functions/CustomElements/sliderButton', () => () => null);
jest.mock('../../app/functions/crashlyticsLogs', () => ({
  crashlyticsLogReport: jest.fn(),
}));
jest.mock('../../context-store/sparkContext', () => ({}));
jest.mock('../../context-store/context', () => ({}));
jest.mock('../../app/functions', () => ({
  formatBalanceAmount: v => String(v),
}));
jest.mock('../../app/functions/formatDate', () => () => '2026-01-01');
jest.mock('../../app/functions/writeFileToFilesystem', () => jest.fn());
jest.mock('../../app/functions/spark/transactions', () => ({
  getAllSparkTransactions: jest.fn(),
}));

const write = require('../../app/functions/writeFileToFilesystem');
const {
  getAllSparkTransactions,
} = require('../../app/functions/spark/transactions');
const { exportTransactionsCsv } = require(`${base}/exportTracker`);

const tx = description => ({
  paymentType: 'lightning',
  details: JSON.stringify({ description, time: 0, fee: 0, amount: 1 }),
});

test('formula-leading descriptions are neutralized, plain ones untouched', async () => {
  getAllSparkTransactions.mockResolvedValue([
    tx('=cmd|calc!A1'),
    tx('+1'),
    tx('-2'),
    tx('@SUM(A1)'),
    tx('coffee = good'),
  ]);
  await exportTransactionsCsv({ accountId: 'a', masterInfoObject: {}, t: k => k });
  const rows = write.mock.calls[0][0].split('\n').slice(1);
  const descriptions = rows.map(r => r.split('","')[1]);
  expect(descriptions).toEqual([
    "'=cmd|calc!A1",
    "'+1",
    "'-2",
    "'@SUM(A1)",
    'coffee = good',
  ]);
});
