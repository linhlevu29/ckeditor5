/**
 * @license Copyright (c) 2003-2019, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/**
 * @module engine/view/stylesmap
 */

import { get, isObject, merge, set, unset } from 'lodash-es';

/**
 * Styles class.
 *
 * Handles styles normalization.
 */
export default class StylesMap {
	/**
	 * Creates Styles instance.
	 */
	constructor( styleProcessor ) {
		/**
		 * @private
		 */
		this._styles = {};

		// Hide _styleProcessor from the watchdog by making this property non-enumarable. Watchdog checks errors for their editor origin
		// by checking if two objects are connected through properties. Using singleton is against this check as it would detect
		// that two editors are connected through single style processor instance.
		Object.defineProperty( this, '_styleProcessor', {
			get() {
				return styleProcessor || StylesMap.processor;
			},
			enumerable: false
		} );
	}

	/**
	 * Number of styles defined.
	 *
	 * @type {Number}
	 */
	get size() {
		return this.getStyleNames().length;
	}

	static get processor() {
		if ( !this._processor ) {
			this._processor = new StylesProcessor();
		}

		return this._processor;
	}

	static setProcessor( processor ) {
		this._processor = processor;
	}

	/**
	 * Set styles map to a new value.
	 *
	 *		styles.setTo( 'border:1px solid blue;margin-top:1px;' );
	 *
	 * @param {String} inlineStyle
	 */
	setTo( inlineStyle ) {
		this.clear();

		for ( const [ key, value ] of Array.from( parseInlineStyles( inlineStyle ).entries() ) ) {
			this._styleProcessor.toNormalizedForm( key, value, this._styles );
		}
	}

	/**
	 * Checks if a given style is set.
	 *
	 *		styles.setTo( 'margin-left:1px;' );
	 *
	 *		styles.hasProperty( 'margin-left' );    // returns true
	 *		styles.hasProperty( 'padding' );        // returns false
	 *
	 * *Note:* This check supports normalized style names.
	 *
	 *		// Enable 'margin' shorthand processing:
	 *		editor.editing.view.document.addStyleProcessorRules( addMarginStylesProcessor );
	 *
	 *		styles.setTo( 'margin:2px;' );
	 *
	 *		styles.hasProperty( 'margin' );         // returns true
	 *		styles.hasProperty( 'margin-top' );     // returns true
	 *		styles.hasProperty( 'margin-left' );    // returns true
	 *
	 *		styles.removeProperty( 'margin-top' );
	 *
	 *		styles.hasProperty( 'margin' );         // returns false
	 *		styles.hasProperty( 'margin-top' );     // returns false
	 *		styles.hasProperty( 'margin-left' );    // returns true
	 *
	 * @param {String} propertyName
	 * @returns {Boolean}
	 */
	hasProperty( propertyName ) {
		const normalized = this._styleProcessor.getNormalized( propertyName, this._styles );

		if ( !normalized ) {
			// Try return styles set directly - values that are not parsed.
			return this._styles[ propertyName ] !== undefined;
		}

		if ( isObject( normalized ) ) {
			const styles = this._styleProcessor.getReducedForm( propertyName, normalized );

			const propertyDescriptor = styles.find( ( [ property ] ) => property === propertyName );

			// Only return a value if it is set;
			return Array.isArray( propertyDescriptor );
		} else {
			return true;
		}
	}

	/**
	 * Inserts single style property.
	 *
	 * Can insert one by one
	 *
	 *		styles.insertProperty( 'color', 'blue' );
	 *		styles.insertProperty( 'margin-right', '1em' );
	 *
	 * or many styles at once:
	 *
	 *		styles.insertProperty( {
	 *			color: 'blue',
	 *			'margin-right': '1em'
	 *		} );
	 *
	 * Supports shorthands.
	 *
	 * @param {String|Object} nameOrObject
	 * @param {String|Object} value
	 * @returns {Boolean}
	 */
	insertProperty( nameOrObject, value ) {
		if ( isObject( nameOrObject ) ) {
			for ( const key of Object.keys( nameOrObject ) ) {
				this.insertProperty( key, nameOrObject[ key ] );
			}
		} else {
			this._styleProcessor.toNormalizedForm( nameOrObject, value, this._styles );
		}
	}

	/**
	 * Removes styles property.
	 *
	 * @param name
	 */
	removeProperty( name ) {
		unset( this._styles, toPath( name ) );
		delete this._styles[ name ];
	}

	/**
	 * Returns a normalized style object or value.
	 *
	 *		const styles = new Styles();
	 *		styles.setTo( 'margin:1px 2px 3em;' );
	 *
	 *		console.log( styles.getNormalized( 'margin' ) );
	 *		// will log:
	 *		// {
	 *		//     top: '1px',
	 *		//     right: '2px',
	 *		//     bottom: '3em',
	 *		//     left: '2px'     // normalized value from margin shorthand
	 *		// }
	 *
	 *		console.log( styles.getNormalized( 'margin-left' ) ); // will log '2px'
	 *
	 * *Note*: This method will only return normalized styles if a style processor was defined.
	 *
	 * @param {String} name
	 * @returns {Object|String|undefined}
	 */
	getNormalized( name ) {
		return this._styleProcessor.getNormalized( name, this._styles );
	}

	/**
	 * Returns a string containing normalized styles string or undefined if no style properties are set.
	 *
	 * @returns {String|undefined}
	 */
	getInlineStyle() {
		const entries = this._getStylesEntries();

		// Return undefined for empty styles map.
		if ( !entries.length ) {
			return;
		}

		return entries
			.map( arr => arr.join( ':' ) )
			.sort()
			.join( ';' ) + ';';
	}

	/**
	 * Returns property value string.
	 *
	 * @param {String} propertyName
	 * @returns {String|undefined}
	 */
	getInlineProperty( propertyName ) {
		const normalized = this._styleProcessor.getNormalized( propertyName, this._styles );

		if ( !normalized ) {
			// Try return styles set directly - values that are not parsed.
			return this._styles[ propertyName ];
		}

		if ( isObject( normalized ) ) {
			const styles = this._styleProcessor.getReducedForm( propertyName, normalized );

			const propertyDescriptor = styles.find( ( [ property ] ) => property === propertyName );

			// Only return a value if it is set;
			if ( Array.isArray( propertyDescriptor ) ) {
				return propertyDescriptor[ 1 ];
			}
		} else {
			return normalized;
		}
	}

	/**
	 * Returns style properties names as the would appear when using {@link #getInlineStyle}
	 *
	 * @returns {module:engine/view/stylesmap~PropertyEntry}
	 */
	getStyleNames() {
		const entries = this._getStylesEntries();

		return entries.map( ( [ key ] ) => key );
	}

	/**
	 * Removes all styles.
	 */
	clear() {
		this._styles = {};
	}

	/**
	 * Returns normalized styles entries for further processing.
	 *
	 * @private
	 * @returns {module:engine/view/stylesmap~PropertyEntry}
	 */
	_getStylesEntries() {
		const parsed = [];

		const keys = Object.keys( this._styles );

		for ( const key of keys ) {
			const normalized = this._styleProcessor.getNormalized( key, this._styles );

			parsed.push( ...this._styleProcessor.getReducedForm( key, normalized ) );
		}

		return parsed;
	}
}

export class StylesProcessor {
	constructor() {
		this._normalizers = new Map();
		this._extractors = new Map();
		this._reducers = new Map();
	}

	/**
	 * Returns reduced form of style property form normalized object.
	 *
	 * @private
	 * @param {String} styleName
	 * @param {Object|String} normalizedValue
	 * @returns {module:engine/view/stylesmap~PropertyEntry}
	 */
	getReducedForm( styleName, normalizedValue ) {
		if ( this._reducers.has( styleName ) ) {
			const reducer = this._reducers.get( styleName );

			return reducer( normalizedValue );
		}

		return [ [ styleName, normalizedValue ] ];
	}

	getNormalized( name, styles ) {
		if ( !name ) {
			return merge( {}, styles );
		}

		if ( styles[ name ] ) {
			return styles[ name ];
		}

		if ( this._extractors.has( name ) ) {
			const extractor = this._extractors.get( name );

			if ( typeof extractor === 'string' ) {
				return get( styles, extractor );
			}

			const value = extractor( name, styles );

			if ( value ) {
				return value;
			}
		}

		return get( styles, toPath( name ) );
	}

	/**
	 * Parse style property value to a normalized form.
	 *
	 * @param {String} propertyName Name of style property.
	 * @param {String} value Value of style property.
	 * @param {Object} styles
	 * @private
	 */
	toNormalizedForm( propertyName, propertyValue, styles ) {
		if ( isObject( propertyValue ) ) {
			appendStyleValue( styles, toPath( propertyName ), propertyValue );

			return;
		}

		if ( this._normalizers.has( propertyName ) ) {
			const normalizer = this._normalizers.get( propertyName );

			const { path, value } = normalizer( propertyValue );

			appendStyleValue( styles, path, value );
		} else {
			appendStyleValue( styles, propertyName, propertyValue );
		}
	}

	setNormalizer( propertyName, callback ) {
		this._normalizers.set( propertyName, callback );
	}

	setExtractor( propertyName, callbackOrPath ) {
		this._extractors.set( propertyName, callbackOrPath );
	}

	setReducer( propertyName, callback ) {
		this._reducers.set( propertyName, callback );
	}
}

// Parses inline styles and puts property - value pairs into styles map.
//
// @param {String} stylesString Styles to parse.
// @returns {Map.<String, String>} stylesMap Map of parsed properties and values.
function parseInlineStyles( stylesString ) {
	// `null` if no quote was found in input string or last found quote was a closing quote. See below.
	let quoteType = null;
	let propertyNameStart = 0;
	let propertyValueStart = 0;
	let propertyName = null;

	const stylesMap = new Map();

	// Do not set anything if input string is empty.
	if ( stylesString === '' ) {
		return stylesMap;
	}

	// Fix inline styles that do not end with `;` so they are compatible with algorithm below.
	if ( stylesString.charAt( stylesString.length - 1 ) != ';' ) {
		stylesString = stylesString + ';';
	}

	// Seek the whole string for "special characters".
	for ( let i = 0; i < stylesString.length; i++ ) {
		const char = stylesString.charAt( i );

		if ( quoteType === null ) {
			// No quote found yet or last found quote was a closing quote.
			switch ( char ) {
				case ':':
					// Most of time colon means that property name just ended.
					// Sometimes however `:` is found inside property value (for example in background image url).
					if ( !propertyName ) {
						// Treat this as end of property only if property name is not already saved.
						// Save property name.
						propertyName = stylesString.substr( propertyNameStart, i - propertyNameStart );
						// Save this point as the start of property value.
						propertyValueStart = i + 1;
					}

					break;

				case '"':
				case '\'':
					// Opening quote found (this is an opening quote, because `quoteType` is `null`).
					quoteType = char;

					break;

				case ';': {
					// Property value just ended.
					// Use previously stored property value start to obtain property value.
					const propertyValue = stylesString.substr( propertyValueStart, i - propertyValueStart );

					if ( propertyName ) {
						// Save parsed part.
						stylesMap.set( propertyName.trim(), propertyValue.trim() );
					}

					propertyName = null;

					// Save this point as property name start. Property name starts immediately after previous property value ends.
					propertyNameStart = i + 1;

					break;
				}
			}
		} else if ( char === quoteType ) {
			// If a quote char is found and it is a closing quote, mark this fact by `null`-ing `quoteType`.
			quoteType = null;
		}
	}

	return stylesMap;
}

function toPath( name ) {
	return name.replace( '-', '.' );
}

// Appends style definition to the styles object.
//
// @param {String} nameOrPath
// @param {String|Object} valueOrObject
// @private
function appendStyleValue( stylesObject, nameOrPath, valueOrObject ) {
	let valueToSet = valueOrObject;

	if ( isObject( valueOrObject ) ) {
		valueToSet = merge( {}, get( stylesObject, nameOrPath ), valueOrObject );
	}

	set( stylesObject, nameOrPath, valueToSet );
}

/**
 * An style reducer takes normalized object of style property and outputs array of normalized property-value pairs that can
 * be later used to inline a style.
 *
 * Those work in opposite direction to "normalize" event and always outputs style in the same way.
 *
 * If normalized style is represented as:
 *
 *		const style = {
 *			border: {
 *				color: {
 *					top: '#f00',
 *					right: '#ba7',
 *					bottom: '#f00',
 *					left: '#ba7'
 *				}
 *			}
 *		}
 *
 * The border reducer will output:
 *
 *		const reduced = [
 *			[ 'border-color', '#f00 #ba7' ]
 *		];
 *
 * which can be used to return the inline style string:
 *
 *		style="border-color:#f00 #ba7;"
 *
 * @event reduce
 */

/**
 * Holds shorthand properties normalizers.
 *
 * Shorthand properties must be normalized as they can be written in various ways.
 * Normalizer must return object describing given shorthand.
 *
 * Example:
 * The `border-color` style is a shorthand property for `border-top-color`, `border-right-color`, `border-bottom-color`
 * and `border-left-color`. Similarly there are shorthand for border width (`border-width`) and style (`border-style`).
 *
 * For `border-color` the given shorthand:
 *
 *		border-color: #f00 #ba7;
 *
 * might be written as:
 *
 *		border-color-top: #f00;
 *		border-color-right: #ba7;
 *		border-color-bottom: #f00;
 *		border-color-left: #ba7;
 *
 * Normalizers produces coherent object representation for both shorthand and longhand forms:
 *
 *		stylesProcessor.on( 'normalize:border-color', ( evt, data ) => {
 *			data.path = 'border.color';
 *			data.value = {
 *				top: '#f00',
 *				right: '#ba7',
 *				bottom: '#f00',
 *				left: '#ba7'
 *			}
 *		} );
 *
 * @event normalize
 */

/**
 * @typedef {Array.<Array.<String>>} module:engine/view/stylesmap~PropertyEntry
 */
