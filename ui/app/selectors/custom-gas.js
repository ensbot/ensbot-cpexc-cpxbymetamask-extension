import { pipe, partialRight } from 'ramda'
import {
  conversionUtil,
  multiplyCurrencies,
  conversionGreaterThan,
} from '../helpers/utils/conversion-util'
import {
  getCurrentCurrency, getIsMainnet, preferencesSelector,
} from './selectors'
import {
  formatCurrency,
} from '../helpers/utils/confirm-tx.util'
import {
  decEthToConvertedCurrency as ethTotalToConvertedCurrency,
} from '../helpers/utils/conversions.util'
import {
  formatETHFee,
} from '../helpers/utils/formatters'
import {
  calcGasTotal,
} from '../pages/send/send.utils'
import { addHexPrefix } from 'ethereumjs-util'
// add 20190725 dadfkim@hanmail.net
import { CPX_MAINNET_CODE, CPX_TESTNET_CODE } from '../../../app/scripts/controllers/network/enums'

const selectors = {
  formatTimeEstimate,
  getAveragePriceEstimateInHexWEI,
  getFastPriceEstimateInHexWEI,
  getBasicGasEstimateLoadingStatus,
  getBasicGasEstimateBlockTime,
  getCustomGasErrors,
  getCustomGasLimit,
  getCustomGasPrice,
  getCustomGasTotal,
  getDefaultActiveButtonIndex,
  getEstimatedGasPrices,
  getEstimatedGasTimes,
  getGasEstimatesLoadingStatus,
  getPriceAndTimeEstimates,
  getRenderableBasicEstimateData,
  getRenderableEstimateDataForSmallButtonsFromGWEI,
  priceEstimateToWei,
  getSafeLowEstimate,
  isCustomPriceSafe,
}

module.exports = selectors

const NUMBER_OF_DECIMALS_SM_BTNS = 5

function getCustomGasErrors (state) {
  return state.gas.errors
}

function getCustomGasLimit (state) {
  return state.gas.customData.limit
}

function getCustomGasPrice (state) {
  return state.gas.customData.price
}

function getCustomGasTotal (state) {
  return state.gas.customData.total
}

function getBasicGasEstimateLoadingStatus (state) {
  return state.gas.basicEstimateIsLoading
}

function getGasEstimatesLoadingStatus (state) {
  return state.gas.gasEstimatesLoading
}

function getPriceAndTimeEstimates (state) {
  return state.gas.priceAndTimeEstimates
}

function getEstimatedGasPrices (state) {
  return getPriceAndTimeEstimates(state).map(({ gasprice }) => gasprice)
}

function getEstimatedGasTimes (state) {
  return getPriceAndTimeEstimates(state).map(({ expectedTime }) => expectedTime)
}

function getAveragePriceEstimateInHexWEI (state) {
  const averagePriceEstimate = state.gas.basicEstimates.average
  return getGasPriceInHexWei(averagePriceEstimate || '0x0')
}

function getFastPriceEstimateInHexWEI (state) {
  const fastPriceEstimate = state.gas.basicEstimates.fast
  return getGasPriceInHexWei(fastPriceEstimate || '0x0')
}

function getDefaultActiveButtonIndex (gasButtonInfo, customGasPriceInHex, gasPrice) {
  return gasButtonInfo.findIndex(({ priceInHexWei }) => {
    return priceInHexWei === addHexPrefix(customGasPriceInHex || gasPrice)
  })
}

function getSafeLowEstimate (state) {
  const {
    gas: {
      basicEstimates: {
        safeLow,
      },
    },
  } = state

  return safeLow
}

function isCustomPriceSafe (state) {
  const safeLow = getSafeLowEstimate(state)
  const customGasPrice = getCustomGasPrice(state)

  if (!customGasPrice) {
    return true
  }

  if (safeLow === null) {
    return null
  }

  const customPriceSafe = conversionGreaterThan(
    {
      value: customGasPrice,
      fromNumericBase: 'hex',
      fromDenomination: 'WEI',
      toDenomination: 'GWEI',
    },
    { value: safeLow, fromNumericBase: 'dec' }
  )

  return customPriceSafe
}

function getBasicGasEstimateBlockTime (state) {
  return state.gas.basicEstimates.blockTime
}

function basicPriceEstimateToETHTotal (estimate, gasLimit, numberOfDecimals = 9) {
  return conversionUtil(calcGasTotal(gasLimit, estimate), {
    fromNumericBase: 'hex',
    toNumericBase: 'dec',
    fromDenomination: 'GWEI',
    numberOfDecimals,
  })
}

// fix add network check and showing alt coin
function getRenderableEthFee (network, estimate, gasLimit, numberOfDecimals = 9) {

  // add change alt coin 20190725 dadfkim@hanmail.net
  let currentCurrency = ' ETH'
  if ( network == CPX_MAINNET_CODE || network == CPX_TESTNET_CODE )
  currentCurrency = ' CPX'

  return pipe(
    x => conversionUtil(x, { fromNumericBase: 'dec', toNumericBase: 'hex' }),
    partialRight(basicPriceEstimateToETHTotal, [gasLimit, numberOfDecimals]),
    partialRight(formatETHFee, [currentCurrency])
  )(estimate, gasLimit, currentCurrency)
}

function getRenderableConvertedCurrencyFee (estimate, gasLimit, convertedCurrency, conversionRate) {
  return pipe(
    x => conversionUtil(x, { fromNumericBase: 'dec', toNumericBase: 'hex' }),
    partialRight(basicPriceEstimateToETHTotal, [gasLimit]),
    partialRight(ethTotalToConvertedCurrency, [convertedCurrency, conversionRate]),
    partialRight(formatCurrency, [convertedCurrency])
  )(estimate, gasLimit, convertedCurrency, conversionRate)
}

function getTimeEstimateInSeconds (blockWaitEstimate) {
  return multiplyCurrencies(blockWaitEstimate, 60, {
    toNumericBase: 'dec',
    multiplicandBase: 10,
    multiplierBase: 10,
    numberOfDecimals: 1,
  })
}

function formatTimeEstimate (totalSeconds, greaterThanMax, lessThanMin) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)

  if (!minutes && !seconds) {
    return '...'
  }

  let symbol = '~'
  if (greaterThanMax) {
    symbol = '< '
  } else if (lessThanMin) {
    symbol = '> '
  }

  const formattedMin = `${minutes ? minutes + ' min' : ''}`
  const formattedSec = `${seconds ? seconds + ' sec' : ''}`
  const formattedCombined = formattedMin && formattedSec
    ? `${symbol}${formattedMin} ${formattedSec}`
    : symbol + [formattedMin, formattedSec].find(t => t)

  return formattedCombined
}

function getRenderableTimeEstimate (blockWaitEstimate) {
  return pipe(
    getTimeEstimateInSeconds,
    formatTimeEstimate
  )(blockWaitEstimate)
}

function priceEstimateToWei (priceEstimate) {
  return conversionUtil(priceEstimate, {
    fromNumericBase: 'hex',
    toNumericBase: 'hex',
    fromDenomination: 'GWEI',
    toDenomination: 'WEI',
    numberOfDecimals: 9,
  })
}

function getGasPriceInHexWei (price) {
  return pipe(
    x => conversionUtil(x, { fromNumericBase: 'dec', toNumericBase: 'hex' }),
    priceEstimateToWei,
    addHexPrefix
  )(price)
}

function getRenderableBasicEstimateData (state, gasLimit) {
  if (getBasicGasEstimateLoadingStatus(state)) {
    return []
  }

  const { showFiatInTestnets } = preferencesSelector(state)
  const isMainnet = getIsMainnet(state)
  const showFiat = (isMainnet || !!showFiatInTestnets)
  const conversionRate = state.metamask.conversionRate
  const currentCurrency = getCurrentCurrency(state)
  const {
    gas: {
      basicEstimates: {
        safeLow,
        fast,
        fastest,
        safeLowWait,
        fastestWait,
        fastWait,
      },
    },
  } = state

  // add
  const network= state.metamask.network

  return [
    {
      labelKey: 'slow',
      feeInPrimaryCurrency: getRenderableEthFee(network, safeLow, gasLimit),
      feeInSecondaryCurrency: showFiat
        ? getRenderableConvertedCurrencyFee(network, safeLow, gasLimit, currentCurrency, conversionRate)
        : '',
      timeEstimate: safeLowWait && getRenderableTimeEstimate(safeLowWait),
      priceInHexWei: getGasPriceInHexWei(safeLow),
    },
    {
      labelKey: 'average',
      feeInPrimaryCurrency: getRenderableEthFee(network, fast, gasLimit),
      feeInSecondaryCurrency: showFiat
        ? getRenderableConvertedCurrencyFee(fast, gasLimit, currentCurrency, conversionRate)
        : '',
      timeEstimate: fastWait && getRenderableTimeEstimate(fastWait),
      priceInHexWei: getGasPriceInHexWei(fast),
    },
    {
      labelKey: 'fast',
      feeInPrimaryCurrency: getRenderableEthFee(network, fastest, gasLimit),
      feeInSecondaryCurrency: showFiat
        ? getRenderableConvertedCurrencyFee(fastest, gasLimit, currentCurrency, conversionRate)
        : '',
      timeEstimate: fastestWait && getRenderableTimeEstimate(fastestWait),
      priceInHexWei: getGasPriceInHexWei(fastest),
    },
  ]
}

function getRenderableEstimateDataForSmallButtonsFromGWEI (state) {
  if (getBasicGasEstimateLoadingStatus(state)) {
    return []
  }

  const { showFiatInTestnets } = preferencesSelector(state)
  const isMainnet = getIsMainnet(state)
  const showFiat = (isMainnet || !!showFiatInTestnets)
  const gasLimit = state.metamask.send.gasLimit || getCustomGasLimit(state) || '0x5208'
  const conversionRate = state.metamask.conversionRate
  const currentCurrency = getCurrentCurrency(state)
  const {
    gas: {
      basicEstimates: {
        safeLow,
        fast,
        fastest,
      },
    },
  } = state

  // add
  const network= state.metamask.network

  return [
    {
      labelKey: 'slow',
      feeInSecondaryCurrency: showFiat
        ? getRenderableConvertedCurrencyFee(safeLow, gasLimit, currentCurrency, conversionRate)
        : '',
      feeInPrimaryCurrency: getRenderableEthFee(network, safeLow, gasLimit, NUMBER_OF_DECIMALS_SM_BTNS, true),
      priceInHexWei: getGasPriceInHexWei(safeLow, true),
    },
    {
      labelKey: 'average',
      feeInSecondaryCurrency: showFiat
        ? getRenderableConvertedCurrencyFee(fast, gasLimit, currentCurrency, conversionRate)
        : '',
      feeInPrimaryCurrency: getRenderableEthFee(network, fast, gasLimit, NUMBER_OF_DECIMALS_SM_BTNS, true),
      priceInHexWei: getGasPriceInHexWei(fast, true),
    },
    {
      labelKey: 'fast',
      feeInSecondaryCurrency: showFiat
        ? getRenderableConvertedCurrencyFee(fastest, gasLimit, currentCurrency, conversionRate)
        : '',
      feeInPrimaryCurrency: getRenderableEthFee(network, fastest, gasLimit, NUMBER_OF_DECIMALS_SM_BTNS, true),
      priceInHexWei: getGasPriceInHexWei(fastest, true),
    },
  ]
}
