// @ts-check
'use strict'

console.log('Script is OK! ༼ つ ◕_◕ ༽つ');

// Types
/** @typedef {import('./lib/chartjs/chart.js').Chart} Chart */
/** @typedef {Record<string, number>[]} ResultList */


const MIN_DRAWDOWN_PERCENTAGE = 2.5;
const MAX_DRAWDOWN_PERCENTAGE = 17.5;
const MIN_BALANCE = 125_000;
const MAX_ANNUITY_TERM = 50;
const COMPOUND_FREQUENCY = 12;
const MIN_RETIREMENT_AGE = 55;

const CRITICAL_ERROR_MESSAGE = "Please refresh the page and try again.";
const CALCULATION_FAILED_ERROR_MESSAGE = "Please check the input values are reasonable";
const CALCULATION_LIMIT_YEARS = 1000;
const CALCULATION_TOO_LONG_ERROR_MESSAGE = `This living annuity will last longer than ${CALCULATION_LIMIT_YEARS} years. Please increase the annual drawdown`;
const INVALID_DRAWDOWN_ERROR_MESSAGE = `The annual drawdown must be between ${MIN_DRAWDOWN_PERCENTAGE}% and ${MAX_DRAWDOWN_PERCENTAGE}%`;
const INVALID_AGE_ERROR_MESSAGE = `The minimum retirement age is ${MIN_RETIREMENT_AGE} for a living annuity`;
const INVALID_PRINCIPAL_ERROR_MESSAGE = `The starting principal must be greater than ${currencyFormat(MIN_BALANCE)}`;


/** @param {Event} event */
function forceNumeric(event) {
    const element = /** @type {?HTMLInputElement} */ (event.target);
    if (!element) return;
    element.value = element.value
        .replace(/[^0-9.]/g, '')
        .replace(/(\..*?)\..*/g, '$1');
}

/**
 * @param {number} num
 * @param {string} space
 * @returns {string}
 */
function currencyFormat(num, space = '&nbsp') {
    return `R${space}` + num.toFixed(2).replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,')
}

/**
 * @param {number} annualDrawdown 
 * @param {number} annualStartBalance 
 * @returns {number}
 */
function getMonthlyIncome(annualDrawdown, annualStartBalance) {
    return annualStartBalance * annualDrawdown / 100 / 12;
}

/** 
 * @param {number} interestRate
 * @returns {number}
 */
function getInterestPayRate(interestRate) {
    const cc = COMPOUND_FREQUENCY / 12;
    const interest = interestRate / 100 / COMPOUND_FREQUENCY;
    return Math.pow(1 + interest, cc) - 1;
}

/**
 * @param {ResultList} monthlyResults 
 * @param {number} age 
 * @returns {ResultList}
 */
function getAnnualResults(monthlyResults, age) {
    let annualResults = [];

    let totalInterest = 0;
    let totalWithdrawn = 0;

    let annualInterest = 0;
    let annualWithdrawals = 0;
    let annualStartBalance = undefined;
    let currentAge = age;

    monthlyResults.forEach((item, index) => {
        totalInterest += item.interestPayment;
        totalWithdrawn += item.withdrawal;
        annualInterest += item.interestPayment;
        annualWithdrawals += item.withdrawal;
        if (annualStartBalance === undefined) {
            annualStartBalance = item.startBalance;
        }

        if ((index + 1) % 12 === 0 || (index + 1) === monthlyResults.length) {
            currentAge += 1;
            annualResults.push({
                startBalance: annualStartBalance,
                endBalance: item.endBalance,
                interestPayment: annualInterest,
                withdrawal: annualWithdrawals,
                totalInterest,
                totalWithdrawn,
                currentAge
            });
            annualInterest = 0;
            annualWithdrawals = 0;
            annualStartBalance = undefined;
        }
    });

    return annualResults;
}

/**
 * @param {number} principal
 * @param {number} interestRate
 * @param {number} annualDrawdown
 */
function calculateLivingAnnuity(
    principal,
    interestRate,
    annualDrawdown
) {
    const ratePayB = getInterestPayRate(interestRate);

    const monthlyResults = [];
    let balance = principal;
    let monthlyIncome = getMonthlyIncome(annualDrawdown, principal);

    for (let i = 0; i < MAX_ANNUITY_TERM * 12; i++) {
        if (i % 12 === 0) {
            if (balance < MIN_BALANCE) break;
            if (i > 0) monthlyIncome = getMonthlyIncome(annualDrawdown, balance);
        }

        const startBalance = balance;

        const interestPayment = balance * ratePayB;
        balance += interestPayment;

        const withdrawal = Math.min(balance, monthlyIncome)
        balance -= withdrawal;

        monthlyResults.push({
            startBalance,
            endBalance: balance,
            interestPayment,
            withdrawal
        });
    }

    return monthlyResults;
}

const customDataLabels = {
    id: 'customDataLabel',
    afterDatasetDraw(chart, args, pluginOptions) {
        const {
            ctx,
            data
        } = chart;
        ctx.save();

        data.datasets[0].data.forEach((datapoint, index) => {
            const { x, y } = chart.getDatasetMeta(0).data[index].tooltipPosition();

            ctx.textAlign = 'center';
            ctx.font = '14px Inter';
            ctx.fillStyle = '#fff';
            ctx.textBaseline = 'middle';
            let toolTipText = datapoint != '0' ? datapoint + '%' : '';
            ctx.fillText(toolTipText, x, y);
        });
    },
};

const colors = {
    primary: '#162953',
    primaryLight: '#25468d',
    secondary: '#00ABD0'
};

const tooltip = {
    enabled: false,
    external: function (context) {
        let tooltipEl = document.getElementById('chartjs-tooltip');

        // Create element on first render
        if (!tooltipEl) {
            tooltipEl = document.createElement('div');
            tooltipEl.id = 'chartjs-tooltip';
            tooltipEl.innerHTML = '<table></table>';
            document.body.appendChild(tooltipEl);
        }

        // Hide if no tooltip
        const tooltipModel = context.tooltip;
        if (tooltipModel.opacity === 0) {
            tooltipEl.style.opacity = '0';
            return;
        }

        // Set caret Position
        tooltipEl.classList.remove('above', 'below', 'no-transform');
        if (tooltipModel.yAlign) {
            tooltipEl.classList.add(tooltipModel.yAlign);
        } else {
            tooltipEl.classList.add('no-transform');
        }

        function getBody(bodyItem) {
            return bodyItem.lines;
        }

        if (tooltipModel.body) {
            const bodyLines = tooltipModel.body.map(getBody);

            let innerHtml = '<thead>';

            let year = +(Number(tooltipModel.title) * 12).toFixed(0);
            let months = +(year % 12).toFixed(0);
            let yearText = `Age ${(year - months) / 12}`;
            let monthText = months === 0 ? '' : `, Month ${months}`;
            innerHtml += '<tr><th class="loan-chart__title">' + yearText + monthText + '</th></tr>';

            innerHtml += '</thead><tbody>';
            bodyLines.forEach(function (body, i) {
                innerHtml += '<tr><td class="loan-chart__text">' + body + '</td></tr>';
            });
            innerHtml += '</tbody>';

            const tableRoot = tooltipEl.querySelector('table');
            if (tableRoot) {
                tableRoot.innerHTML = innerHtml;
            }
        }

        const position = context.chart.canvas.getBoundingClientRect();

        // Display, position, and set styles for font
        tooltipEl.style.opacity = '1';
        tooltipEl.style.position = 'absolute';
        tooltipEl.style.left = position.left + window.scrollX + tooltipModel.caretX - tooltipEl.clientWidth / 2 + 'px';
        tooltipEl.style.top = position.top + window.scrollY + tooltipModel.caretY - tooltipEl.clientHeight / 2 + 'px';
        tooltipEl.classList.add('loan-chart');
    },
};

const secondaryChartData = [
    {
        data: [10, 60, 30],
        backgroundColor: [colors.primary, colors.primaryLight, colors.secondary],
        borderColor: colors.primary,
        borderWidth: 0.5,
    },
];

const primaryChartData = {
    labels: [
        56,
        57,
        58,
        59,
        60,
        61,
        62,
        63,
        64,
        65,
        66,
        67,
        68,
        69,
        70,
        71,
        72,
        73,
        74,
        75,
        76,
        77,
        78,
        79,
        80,
        81,
        82,
        83,
        84,
        85,
        86,
        87,
        88,
        89,
        90,
        91,
        92,
        93,
        94,
        95,
        96,
        97,
        98,
        99,
        100,
        101,
        102,
        103,
        104,
        105
    ],
    datasets: [
        {
            label: 'Ending Balance',
            data: [
                1031124.8150528162,
                1063218.3842177037,
                1096310.8597872325,
                1130433.3325385042,
                1165617.8609433016,
                1201897.5012874212,
                1239306.3387274342,
                1277879.5193141077,
                1317653.28301254,
                1358664.9977500418,
                1400953.1945237464,
                1444557.6036009488,
                1489519.1918461658,
                1535880.2012099973,
                1583684.1884159404,
                1632976.0658824537,
                1683802.14391872,
                1736210.1742337258,
                1790249.3947995682,
                1845970.5761111209,
                1903426.0688855182,
                1962669.8532462895,
                2023757.5894383164,
                2086746.6701213147,
                2151696.2742909207,
                2218667.4228780568,
                2287723.036078843,
                2358927.9924688623,
                2432349.189957368,
                2508055.608638655,
                2586118.375599709,
                2666610.83174494,
                2749608.6007008348,
                2835189.659865277,
                2923434.4136682404,
                3014425.769112699,
                3108249.213666775,
                3204992.895580211,
                3304747.706700734,
                3407607.36786801,
                3513668.516965511,
                3623030.7997129653,
                3735796.9632846876,
                3852072.9528417937,
                3971968.0110689504,
                4095594.7808091734,
                4223069.410893134,
                4354511.665262392,
                4490045.035489017,
                4629796.8567974195
            ],
            stack: "1",
            backgroundColor: colors.primary,
            borderColor: colors.primary,
        },
        {
            label: 'Total Interest',
            data: [
                81124.81505281568,
                164774.6249703442,
                251028.01975075895,
                339966.0354913914,
                431672.2305231155,
                526232.7639143994,
                623736.4764187828,
                724274.9739418279,
                827942.7136059657,
                934837.0924940936,
                1045058.5391553,
                1158710.60795869,
                1275900.0763839558,
                1396737.0453400952,
                1521335.0426065377,
                1649811.1294938494,
                1782286.0108242382,
                1918884.148335179,
                2059733.877612707,
                2204967.5286642374,
                2354721.5502441917,
                2509136.6380492374,
                2668357.866903579,
                2832534.8270584936,
                3001821.7647341643,
                3176377.7270358475,
                3356366.711380537,
                3541957.819574499,
                3733325.4166864455,
                3930649.294865603,
                4134114.8422585907,
                4343913.217183805,
                4560241.527726947,
                4783303.016926434,
                5013307.25372266,
                5250470.329850532,
                5495015.062860242,
                5747171.205457019,
                6007175.661356551,
                6275272.707858865,
                6551714.22534977,
                6836759.9339454975,
                7130677.637502865,
                7433743.475224206,
                7746242.181093451,
                8068467.35138712,
                8400721.720511543,
                8743317.445425449,
                9096576.39891519,
                9460830.471998053
            ],
            stack: "2",
            backgroundColor: colors.primaryLight,
            borderColor: colors.primaryLight,
        },
        {
            label: 'Total Withdrawn',
            data: [
                49999.99999999999,
                101556.24075264078,
                154717.15996352598,
                209532.70295288775,
                266054.36957981286,
                324335.26262697775,
                384430.1376913487,
                446395.4546277205,
                510289.4305934262,
                576172.0947440527,
                644105.3446315546,
                714153.0043577421,
                786380.8845377895,
                860856.8441300974,
                937650.8541905968,
                1016835.0636113938,
                1098483.8669055174,
                1182673.9741014526,
                1269484.482813138,
                1358996.9525531153,
                1451295.481358672,
                1546466.7848029467,
                1644600.277465262,
                1745788.1569371787,
                1850125.4904432432,
                1957710.3041577903,
                2068643.6753016938,
                2183029.8271056362,
                2300976.226729077,
                2422593.6862269477,
                2547996.4666588814,
                2677302.3854388655,
                2810632.927026114,
                2948113.3570611575,
                3089872.8400544194,
                3236044.560737834,
                3386765.8491934673,
                3542178.3098768075,
                3702427.9546558172,
                3867665.3399908547,
                4038045.7083842573,
                4213729.134232531,
                4394880.674218184,
                4581670.522382419,
                4774274.170024506,
                4972872.570577952,
                5177652.309618416,
                5388805.780163067,
                5606531.3634261815,
                5831033.615200638
            ],
            stack: "3",
            backgroundColor: colors.secondary,
            borderColor: colors.secondary,
        }
    ],
};

const $errorBox = document.getElementById('error-box');
const $errorList = document.getElementById('error-list');
const $annualResultsTable = document.getElementById('annual-results');
const $monthlyResultsTable = document.getElementById('monthly-results');

const $primaryChart = document.getElementById('primary-chart');
const $calculateBtn = document.getElementById('calculate-btn');

const $startingPrincipal = document.getElementById('starting-principal');
const $interestRate = document.getElementById('interest-rate');
const $annualDrawdown = document.getElementById('annual-drawdown');
const $age = document.getElementById('age');

const $main = document.getElementById('result-main');
const $smallA = document.getElementById('result-small-A');
const $smallB = document.getElementById('result-small-B');
const $smallC = document.getElementById('result-small-C');

const input = {
    value: /** @type {*} */ (null),
    elementId: "",
    shown: false,
    processed: false,
    silent: false,
    reset: function () {
        this.shown = false;
        $errorBox?.classList.remove('calculator-result--error-active');
        document.querySelectorAll('.input-field--error')?.forEach(el => el.classList.remove('input-field--error'))
        document.querySelectorAll('.calculator-result:not(.calculator-result--error)').forEach(el => el.classList.remove('calculator-result--hidden'))
    },
    error: function (inputId, message = `Incorrect value for "${inputId}"`, last = false) {
        if (this.silent) return;
        if (this.processed) this.reset();
        if (!Array.isArray(inputId)) inputId = [inputId];
        for (const inputIdItem of inputId) {
            const wrapperElement = /** @type {?HTMLElement} */ (document.getElementById(inputIdItem)?.parentNode);
            wrapperElement?.classList.add('input-field--error');
        }
        if (!this.shown) {
            this.processed = false;
            this.shown = true;
            $errorList && ($errorList.innerHTML = '');
            $errorBox?.classList.add('calculator-result--error-active');
            document.querySelectorAll('.calculator-result:not(.calculator-result--error)').forEach(el => el.classList.add('calculator-result--hidden'))
        }
        const element = document.createElement('p');
        element.classList.add('calculator-error__item');
        element.innerHTML = message;
        $errorList?.append(element);
        if (last) this.processed = true;
    },
    valid: function () {
        if (!this.shown || this.processed) this.reset();
        this.processed = true;
        this.silent = false;
        return !this.shown;
    },
    get: function (elementId) {
        this.elementId = elementId;
        let element = /** @type {HTMLInputElement} */ (document.getElementById(elementId));
        this.silent = false;
        if (element == null) {
            this.value = null;
        } else {
            this.value = element.value;
        }
        return this;
    },
    index: function () {
        const element = /** @type {?HTMLSelectElement} */ (document.getElementById(this.elementId));
        this.value = element?.selectedIndex;
        return this;
    },
    checked: function (elementId) {
        const element = /** @type {?HTMLInputElement} */ (document.getElementById(this.elementId))
        this.value = element?.checked;
        return this;
    },
    split: function (separator) {
        this.value = this.value.split(separator);
        return this;
    },
    replace: function (pattern, replacement) {
        this.value = this.value.replace(pattern, replacement);
        return this;
    },
    default: function (value) {
        if (!this.value) this.value = value;
        return this;
    },
    optional: function (value) {
        if (!this.value) this.silent = true;
        return this;
    },
    gt: function (compare = 0, errorText = `The ${this.elementId} must be greater than ${compare}.`) {
        if (isNaN(compare)) {
            const element = /** @type {?HTMLInputElement} */ (document.getElementById(this.elementId));
            compare = Number(element?.value);
        }
        if (this.value === '' || isNaN(Number(this.value)))
            this.error(this.elementId, `The ${this.elementId} must be a number.`);
        else if (Number(this.value) <= compare) this.error(this.elementId, errorText);
        return this;
    },
    gte: function (compare = 0, errorText = `The ${this.elementId} must be greater than or equal to ${compare}.`) {
        if (isNaN(compare)) {
            const element = /** @type {?HTMLInputElement} */ (document.getElementById(this.elementId));
            compare = Number(element?.value);
        }
        if (this.value === '' || isNaN(Number(this.value)))
            this.error(this.elementId, `The ${this.elementId} must be a number.`);
        else if (Number(this.value) < compare) this.error(this.elementId, errorText);
        return this;
    },
    lt: function (compare = 0, errorText = `The ${this.elementId} must be less than ${compare}.`) {
        if (isNaN(compare)) {
            const element = /** @type {?HTMLInputElement} */ (document.getElementById(this.elementId));
            compare = Number(element?.value);
        }
        if (this.value === '' || isNaN(Number(this.value)))
            this.error(this.elementId, `The ${this.elementId} must be a number.`);
        else if (Number(this.value) >= compare) this.error(this.elementId, errorText);
        return this;
    },
    lte: function (compare = 0, errorText = `The ${this.elementId} must be less than or equal to ${compare}.`) {
        if (isNaN(compare)) {
            const element = /** @type {?HTMLInputElement} */ (document.getElementById(this.elementId));
            compare = Number(element?.value);
        }
        if (this.value === '' || isNaN(Number(this.value)))
            this.error(this.elementId, `The ${this.elementId} must be a number.`);
        else if (Number(this.value) > compare) this.error(this.elementId, errorText);
        return this;
    },
    integer: function (errorText = `The ${this.elementId
        } must be integer number (-3, -2, -1, 0, 1, 2, 3, ...).`) {
        if (!this.value.match(/^-?(0|[1-9]\d*)$/)) this.error(this.elementId, errorText);
        return this;
    },
    _naturalRegexp: /^([1-9]\d*)$/,
    natural: function (errorText = `The ${this.elementId} must be a natural number(1, 2, 3, ...).`) {
        if (!this.value.match(this._naturalRegexp)) this.error(this.elementId, errorText);
        return this;
    },
    natural_numbers: function (errorText = `The ${this.elementId} must be a set of natural numbers(1, 2, 3, ...).`) {
        this.split(/[ ,]+/);
        if (!this.value.every(value => value.match(this._naturalRegexp))) this.error(this.elementId, errorText);
        return this;
    },
    _mixedRegexp: /^(0|-?[1-9]\d*|-?[1-9]\d*\/[1-9]\d*|-?[1-9]\d*\s[1-9]\d*\/[1-9]\d*)$/,
    mixed: function (errorText = `The ${this.elementId} must be an integer / fraction / mixed number(1, 2 / 3, 4 5 / 6, ...).`) {
        if (!this.value.match(this._mixedRegexp)) this.error(this.elementId, errorText);
        return this;
    },
    mixed_numbers: function (errorText = `The ${this.elementId} must be a set of integer / fraction / mixed numbers(1, 2 / 3, 4 5 / 6, ...).`) {
        this.split(/,\s*/);
        if (!this.value.every(value => value.match(this._mixedRegexp))) this.error(this.elementId, errorText);
        return this;
    },
    number: function (errorText = `The "${this.elementId}" must be a number.`) {
        if (this.value === '' || isNaN(Number(this.value))) this.error(this.elementId, errorText);
        return this;
    },
    probability: function (errorText = `The "${this.elementId}" must be a number between 0 and 1.`) {
        if (this.value === '' || isNaN(Number(this.value)) || Number(this.value) < 0 || Number(this.value) > 1)
            this.error(this.elementId, errorText);
        return this;
    },
    percentage: function (errorText = `The "${this.elementId}" must be a number between 0 and 100.`) {
        if (this.value === '' || isNaN(Number(this.value)) || Number(this.value) < 0 || Number(this.value) > 100)
            this.error(this.elementId, errorText);
        return this;
    },
    numbers: function (errorText = `The ${this.elementId} must be a set of numbers.`) {
        if (this.value.filter(value => isNaN(Number(value))).length) this.error(this.elementId, errorText);
        return this;
    },
    whole: function (errorText = `The ${this.elementId} must be a whole number.`) {
        if (!this.value.match(/^(0|[1-9]\d*)$/)) this.error(this.elementId, errorText);
        return this;
    },
    positive: function (errorText = `The ${this.elementId} must be greater than 0.`) {
        this.gt(0, errorText);
        return this;
    },
    nonZero: function (errorText = `The ${this.elementId} must be non - zero.`) {
        if (this.value === '' || isNaN(Number(this.value)))
            this.error(this.elementId, `The ${this.elementId} must be a number.`);
        else
            if (Number(this.value) == 0) this.error(this.elementId, errorText);
        return this;
    },
    nonNegative: function (errorText = `The ${this.elementId} must be greater than or equal to 0.`) {
        this.gte(0, errorText);
        return this;
    },
    negative: function (errorText = `The ${this.elementId} must be less than 0.`) {
        this.lt(0, errorText);
        return this;
    },
    bool: function () {
        return !!this.value;
    },
    val: function () {
        if (this.value === '' || this.value === null) return null;
        return Number(this.value);
    },
    vals: function () {
        return this.value.map(value => Number(value));
    },
    raw: function () {
        return this.value;
    }
}

/** @param {ResultList} monthlyResults */
const displayCalculationResults = (monthlyResults) => {
    const totalWithdrawn = monthlyResults.map(it => it.withdrawal).reduce((a, b) => a + b);
    const totalInterest = monthlyResults.map(it => it.interestPayment).reduce((a, b) => a + b);
    const actualAnnuityTerm = monthlyResults.length / 12;
    const initialMonthlyIncome = monthlyResults[0]?.withdrawal;

    const main = `Annuity Term: ${actualAnnuityTerm.toFixed(0)}${actualAnnuityTerm >= MAX_ANNUITY_TERM ? '+' : ''} years`;
    const smallA = `Initial Monthly Income: ${currencyFormat(initialMonthlyIncome)}`;
    const smallB = `Total Withdrawn: ${currencyFormat(totalWithdrawn)}`;
    const smallC = `Total Interest: ${currencyFormat(totalInterest)}`;

    $main && ($main.innerHTML = main);
    $smallA && ($smallA.innerHTML = smallA);
    $smallB && ($smallB.innerHTML = smallB);
    $smallC && ($smallC.innerHTML = smallC);
}

/** @param {ResultList} annualResults */
const displayAnnualResultsTable = (annualResults) => {
    let annualResultsHtml = '';
    annualResults.forEach((r) => {
        const drawdown = r.withdrawal / r.startBalance * 100;
        annualResultsHtml += `<tr>
            <td class="text-center">${r.currentAge}</td>
            <td>${currencyFormat(r.startBalance)}</td>
            <td>${currencyFormat(r.interestPayment)}</td>
            <td>${currencyFormat(r.withdrawal)}</td>
            <td>${currencyFormat(r.endBalance)}</td>
            <td>${drawdown.toFixed(1)}%</td>
        </tr>`;
    });

    $annualResultsTable && ($annualResultsTable.innerHTML = annualResultsHtml);
}

/** @param {ResultList} monthlyResults */
const displayMonthlyResultsTable = (monthlyResults) => {
    let monthlyResultsHtml = '';
    monthlyResults.forEach((item, index) => {
        monthlyResultsHtml += `<tr>
            <td class="text-center">${index + 1}</td>
            <td>${currencyFormat(item.startBalance)}</td>
            <td>${currencyFormat(item.interestPayment)}</td>
            <td>${currencyFormat(item.withdrawal)}</td>
            <td>${currencyFormat(item.endBalance)}</td>
        </tr>`;

        if ((index + 1) % 12 === 0 || (index + 1) === monthlyResults.length) {
            const year = Math.ceil((index + 1) / 12);
            const title = `Year #${year} End`;
            monthlyResultsHtml += `<th class="white text-center" colspan="6">${title}</th>`;
        }
    });

    $monthlyResultsTable && ($monthlyResultsTable.innerHTML = monthlyResultsHtml);
}

/**
 * @param {ResultList} annualResults
 * @param {Chart} primaryChart
 */
const displayPrimaryResultsChart = (annualResults, primaryChart) => {
    primaryChart.data.labels = annualResults.map(it => it.currentAge);
    primaryChart.data.datasets[0].data = annualResults.map(it => it.endBalance);
    primaryChart.data.datasets[1].data = annualResults.map(it => it.totalInterest);
    primaryChart.data.datasets[2].data = annualResults.map(it => it.totalWithdrawn);

    primaryChart.reset();
    primaryChart.update();
}

const getInputs = () => {
    input.reset();

    const principal = input.get($startingPrincipal?.id)
        .number(CRITICAL_ERROR_MESSAGE)
        .gte(MIN_BALANCE, INVALID_PRINCIPAL_ERROR_MESSAGE)
        .val();
    const interestRate = input.get($interestRate?.id)
        .number(CRITICAL_ERROR_MESSAGE)
        .percentage('The annual interest rate must be between 0% and 100%')
        .val();
    const annualDrawdown = input.get($annualDrawdown?.id)
        .number()
        .gte(MIN_DRAWDOWN_PERCENTAGE, INVALID_DRAWDOWN_ERROR_MESSAGE)
        .lte(MAX_DRAWDOWN_PERCENTAGE, INVALID_DRAWDOWN_ERROR_MESSAGE)
        .val();
    const age = input.get($age?.id)
        .number()
        .gte(MIN_RETIREMENT_AGE, INVALID_AGE_ERROR_MESSAGE)
        .val();

    if (!input.valid()) throw new Error("Invalid State");

    if (
        principal === null ||
        interestRate === null ||
        annualDrawdown === null ||
        age === null
    ) {
        input.error([], CRITICAL_ERROR_MESSAGE, true);
        throw new Error("Invalid state");
    }

    return { principal, interestRate, annualDrawdown, age };
}

/**
 * @param {Chart} primaryChart
 */
const runApp = (primaryChart) => {
    const {
        principal,
        interestRate,
        annualDrawdown,
        age
    } = getInputs();

    const monthlyResults = calculateLivingAnnuity(
        principal,
        interestRate,
        annualDrawdown
    );
    const annualResults = getAnnualResults(monthlyResults, age);

    displayCalculationResults(monthlyResults);
    displayMonthlyResultsTable(monthlyResults);
    displayAnnualResultsTable(annualResults);
    displayPrimaryResultsChart(annualResults, primaryChart);
}

[
    $startingPrincipal,
    $interestRate,
    $annualDrawdown,
    $age
].forEach(input => input?.addEventListener('input', forceNumeric));

import("./lib/chartjs/chart.js").then(({ Chart, registerables }) => {
    Chart.register(...registerables);

    const primaryChart = new Chart($primaryChart, {
        type: 'line',
        data: primaryChartData,
        options: {
            response: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false,
                },
                tooltip: tooltip,
            },
            interaction: {
                mode: 'index',
                intersect: false,
            },
            scales: {
                y: {
                    stacked: true,
                    ticks: {
                        callback: (it) => currencyFormat(it, ' '),
                    },
                },
                x: {
                    stacked: true,
                    grid: {
                        display: false
                    },
                },
            },
        }
    });

    $calculateBtn?.addEventListener('click', () => runApp(primaryChart));
})
