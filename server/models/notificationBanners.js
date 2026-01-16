const Model = require('objection').Model

/* global WIKI */

/**
 * Notification Banners model
 */
module.exports = class NotificationBanner extends Model {
  static get tableName() { return 'notificationBanners' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['text', 'urgency', 'startDate', 'endDate'],

      properties: {
        id: {type: 'integer'},
        text: {type: 'string'},
        urgency: {type: 'string', enum: ['info', 'success', 'error']},
        icon: {type: 'string'},
        backgroundColor: {type: 'string'},
        textColor: {type: 'string'},
        startDate: {type: 'string'},
        endDate: {type: 'string'},
        isActive: {type: 'boolean'},
        createdAt: {type: 'string'},
        updatedAt: {type: 'string'}
      }
    }
  }

  $beforeUpdate() {
    this.updatedAt = new Date().toISOString()
  }

  $beforeInsert() {
    this.createdAt = new Date().toISOString()
    this.updatedAt = new Date().toISOString()
  }

  /**
   * Get active banner for display
   */
  static async getActiveBanner() {
    const now = new Date().toISOString()
    
    const banner = await WIKI.models.notificationBanners.query()
      .where('isActive', true)
      .where(function() {
        this.whereNull('startDate').orWhere('startDate', '<=', now)
      })
      .where(function() {
        this.whereNull('endDate').orWhere('endDate', '>=', now)
      })
      .orderBy('createdAt', 'desc')
      .first()
    
    return banner || null
  }

  /**
   * Get all active banners for display
   */
  static async getActiveBanners() {
    const now = new Date().toISOString()
    
    const banners = await WIKI.models.notificationBanners.query()
      .where('isActive', true)
      .where(function() {
        this.whereNull('startDate').orWhere('startDate', '<=', now)
      })
      .where(function() {
        this.whereNull('endDate').orWhere('endDate', '>=', now)
      })
      .orderBy('createdAt', 'desc')
    
    return banners || []
  }

  /**
   * Get all banners (for admin)
   */
  static async getAllBanners() {
    return WIKI.models.notificationBanners.query()
      .orderBy('createdAt', 'desc')
  }

  /**
   * Create new banner
   */
  static async createBanner(data) {
    return WIKI.models.notificationBanners.query()
      .insert(data)
  }

  /**
   * Update banner
   */
  static async updateBanner(id, data) {
    return WIKI.models.notificationBanners.query()
      .patchAndFetchById(id, data)
  }

  /**
   * Delete banner
   */
  static async deleteBanner(id) {
    return WIKI.models.notificationBanners.query()
      .deleteById(id)
  }

  /**
   * Toggle banner active status
   */
  static async toggleBannerStatus(id) {
    const banner = await WIKI.models.notificationBanners.query()
      .findById(id)
    
    if (banner) {
      return WIKI.models.notificationBanners.query()
        .patchAndFetchById(id, { isActive: !banner.isActive })
    }
    
    return null
  }
}
