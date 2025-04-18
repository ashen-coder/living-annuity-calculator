// @ts-check
'use strict'

console.log('Script is OK! ༼ つ ◕_◕ ༽つ');

// Types
/** @typedef {import('./lib/chartjs/chart.js').Chart} Chart */
/** @typedef {Record<string, number>[]} ResultList */

let currencySymbol = 'R';
let showCurrencyDecimals = true;

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
const INVALID_PRINCIPAL_ERROR_MESSAGE = () => `The starting principal must be greater than ${currencyFormat(MIN_BALANCE)}`;

/** @param {Event} event */
function forceNumeric(event) {
    const element = /** @type {?HTMLInputElement} */ (event.target);
    if (!element) return;
    element.value = element.value
        .replace(/[^0-9.]/g, '')
        .replace(/(\..*?)\..*/g, '$1');
}

/** @param {string} value */
function getCurrencySymbol(value) {
    switch (value) {
        case 'USD':
            return '$';
        case 'EUR':
            return '€';
        case 'GBP':
            return '£';
        case 'JPY':
            return '¥';
        case 'CHF':
            return 'CHF';
        case 'CAD':
            return 'C$';
        case 'AUD':
            return 'A$';
        case 'CNY':
            return '¥';
        case 'INR':
            return '₹';
        case 'AED':
            return 'AED';
        case 'ZAR':
        default:
            return 'R';
    }
}

/**
 * @param {number} num
 * @param {string} space
 * @returns {string}
 */
function currencyFormat(num, space = '&nbsp') {
    return `${currencySymbol}${space}` + num.toFixed(showCurrencyDecimals ? 2 : 0).replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,')
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
    const interest = Math.pow(1 + (interestRate / 100), 1 / COMPOUND_FREQUENCY) - 1;
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
                1028192.13966452,
                1057179.0760679035,
                1086983.216230817,
                1117627.598875784,
                1149135.9122362116,
                1181532.51236749,
                1214842.4419743258,
                1249091.4497688524,
                1284306.0103744925,
                1320513.3447909525,
                1357741.44143616,
                1396019.0777814335,
                1435375.8425965807,
                1475842.1588221407,
                1517449.3070864414,
                1560229.449885651,
                1604215.6564455226,
                1649441.9282840434,
                1695943.2254947408,
                1743755.4937709856,
                1792915.6921921514,
                1843461.8217931401,
                1895432.9549393433,
                1948869.265529727,
                2003812.0600514312,
                2060303.8095098487,
                2118388.1822588914,
                2178110.077756801,
                2239515.6612736164,
                2302652.3995771213,
                2367569.0976248384,
                2434315.936290477,
                2502944.5111539424,
                2573507.8723849338,
                2646060.5657509523,
                2720658.6747813798,
                2797359.8641203037,
                2876223.424101507,
                2957310.316580136,
                3040683.222056487,
                3126406.5881282673,
                3214546.679308853,
                3305171.628250047,
                3398351.488408881,
                3494158.2881992296,
                3592666.086670081,
                3693951.0307534686,
                3798091.4141263627,
                3905167.737732026,
                4015262.7720075436
            ],
            stack: "1",
            backgroundColor: colors.primary,
            borderColor: colors.primary,
        },
        {
            label: 'Total Interest',
            data: [
                78192.1396645195,
                158588.68305112878,
                241251.77701743797,
                326245.3204739466,
                413635.0137781634,
                503488.4095212522,
                595874.9647464615,
                690866.0946397037,
                788535.227733787,
                888957.8626689713,
                992211.6265537272,
                1098376.334970809,
                1207534.0536750283,
                1319769.1620304175,
                1435168.4182358242,
                1553821.0263893553,
                1675818.7054435106,
                1801255.760104308,
                1930229.153729208,
                2062838.5832801887,
                2199186.5563899027,
                2339378.4706005,
                2483522.6948363585,
                2631730.653173709,
                2784116.9109718986,
                2940799.2634328883,
                3101898.826657424,
                3267540.131268279,
                3437851.218672936,
                3612963.7400401207,
                3793013.058066696,
                3978138.351613578,
                4168482.723291569,
                4364193.310080262,
                4565421.397065525,
                4772322.534383501,
                4985056.657461493,
                5203788.210648709,
                5428686.274332416,
                5659924.695637775,
                5897682.222812377,
                6142142.643399378,
                6393494.926306014,
                6651933.36787735,
                6917657.742088145,
                7190873.454968957,
                7471791.703385847,
                7760629.638296418,
                8057610.532608399,
                8362963.953770517
            ],
            stack: "2",
            backgroundColor: colors.primaryLight,
            borderColor: colors.primaryLight,
        },
        {
            label: 'Total Withdrawn',
            data: [
                49999.99999999999,
                101409.60698322597,
                154268.56078662112,
                208617.72159816202,
                264499.10154195136,
                321955.8971537622,
                381032.5227721369,
                441774.6448708529,
                504229.2173592952,
                568444.5178780195,
                634470.1851175667,
                702357.2571893751,
                772158.211078447,
                843927.0032082766,
                917719.1111493839,
                993591.5765037055,
                1071603.0489979882,
                1151813.8318202647,
                1234285.9282344675,
                1319083.0895092033,
                1406270.8641977517,
                1495916.64880736,
                1588089.7398970157,
                1682861.387643982,
                1780304.8509204679,
                1880495.4539230403,
                1983510.644398534,
                2089430.0535114792,
                2198335.5573993204,
                2310311.3404630003,
                2425443.9604418585,
                2543822.415323102,
                2665538.2121376274,
                2790685.437695327,
                2919360.831314572,
                3051663.8596021207,
                3187696.7933411887,
                3327564.7865472017,
                3471375.957752279,
                3619241.473581285,
                3771275.6346841073,
                3927595.9640905196,
                4088323.298055961,
                4253581.879468462,
                4423499.453888903,
                4598207.368298865,
                4777840.672632373,
                4962538.224170043,
                5152442.7948763585,
                5347701.181762959
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
const $monthlyFigures = document.getElementById('monthly-figures');

const $primaryChart = document.getElementById('primary-chart');
const $calculateBtn = document.getElementById('calculate-btn');
const $showMonthlyFigures = /** @type {HTMLInputElement} */ (document.getElementById('show-monthly-figures'));

const $startingPrincipal = document.getElementById('starting-principal');
const $interestRate = document.getElementById('interest-rate');
const $annualDrawdown = document.getElementById('annual-drawdown');
const $age = document.getElementById('age');

const $main = document.getElementById('result-main');
const $smallA = document.getElementById('result-small-A');
const $smallB = document.getElementById('result-small-B');
const $smallC = document.getElementById('result-small-C');

const $currency = /** @type {HTMLSelectElement} */ (document.getElementById('currency'));

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
        .gte(MIN_BALANCE, INVALID_PRINCIPAL_ERROR_MESSAGE())
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

/**
 * @param {Chart} primaryChart
 */
const changeCurrency = (primaryChart) => {
    currencySymbol = getCurrencySymbol($currency.value);
    showCurrencyDecimals = $currency.value !== 'JPY';
    document.querySelectorAll('.input-field__currency').forEach(el => el.textContent = currencySymbol);
    runApp(primaryChart);
};

[
    $startingPrincipal,
    $interestRate,
    $annualDrawdown,
    $age
].forEach(input => input?.addEventListener('input', forceNumeric));

$showMonthlyFigures?.addEventListener('change', () => {
    if ($showMonthlyFigures.checked) {
        $monthlyFigures?.classList.remove('hidden');
    } else {
        $monthlyFigures?.classList.add('hidden');
    }
});

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
    $currency.addEventListener('change', () => changeCurrency(primaryChart));
})
